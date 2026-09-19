import type { ResolvedRoute } from "./config.js";
import type { RouterResult, StreamPart, NormalizedUsage } from "./response.js";
import { RuntimeFault, type RuntimeBoundary, type RuntimeTool } from "./runtime-client.js";
import { productionThreadPolicy } from "./native-execution-policy.js";
import { RunJournal, canonicalJson, fingerprint, type PendingToolIdentity } from "./runtime-state.js";
import {
  dynamicTools,
  initialRuntimeInput,
  hostToolResults,
  normalizedTranscript,
  type RuntimeToolSet
} from "./runtime-wire.js";
import { isRecord, type JsonObject } from "./sand-values.js";

interface RuntimeEvent {
  sequence: number;
  generation: number;
  method: string;
  params: JsonObject;
  thread_id?: string | null;
  turn_id?: string | null;
  request_id?: string | number | null;
  known?: boolean | null;
}

interface PendingCall extends PendingToolIdentity { arguments: unknown }
interface Tokens { input: number; cached: number; output: number; context: number }

export interface RuntimeExecutionOptions {
  boundary: RuntimeBoundary;
  stateDirectory: string;
  conversationId: string;
  transcriptId: string;
  executorOrdinal: number;
  route: ResolvedRoute;
}

function identifier(value: unknown, code: string): string {
  if (typeof value !== "string" || !value) throw new RuntimeFault(code, true);
  return value;
}

function count(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new RuntimeFault("INVALID_USAGE", true);
  return value as number;
}

function transcriptFingerprint(messages: unknown[]): string {
  return fingerprint(normalizedTranscript(messages));
}

function usageDelta(current: Tokens, previous: Tokens): NormalizedUsage {
  const prompt = current.input - previous.input;
  const cached = current.cached - previous.cached;
  const output = current.output - previous.output;
  if (prompt < 0 || cached < 0 || output < 0 || cached > prompt) throw new RuntimeFault("NONMONOTONIC_USAGE", true);
  return {
    usage: { promptTokens: prompt, completionTokens: output, totalTokens: prompt + output },
    extendedUsage: { inputTokens: prompt - cached, outputTokens: output, cacheReadTokens: cached,
      cacheWriteTokens: 0, maxTokens: current.context }
  };
}

/** One Grok PromptExecutor / inference run, lazily owning one App Server thread. */
export class RuntimeExecution {
  private readonly journal: RunJournal;
  private sessionId: string | undefined;
  private threadId: string | undefined;
  private turnId: string | undefined;
  private turnOperationId: string | undefined;
  private generation: number | undefined;
  private cursor = 0;
  private consumedMessages = 0;
  private consumedPrefixHash: string | undefined;
  private readonly observedMessages = new Map<string, { text: string; phase: unknown; complete: boolean }>();
  private tools: RuntimeToolSet | undefined;
  private toolFingerprint: string | undefined;
  private pending: PendingCall[] = [];
  private readonly seenCalls = new Set<string>();
  private readonly seenRequests = new Set<string>();
  private echoHashes: string[] = [];
  private busy = false;
  private failed = false;
  private finished = false;
  private cancellationRequested = false;
  private currentTokens: Tokens = { input: 0, cached: 0, output: 0, context: 0 };
  private reportedTokens: Tokens = { input: 0, cached: 0, output: 0, context: 0 };

  constructor(private readonly options: RuntimeExecutionOptions) {
    if (!options.conversationId || !options.transcriptId || !Number.isSafeInteger(options.executorOrdinal) ||
        options.executorOrdinal < 0 || options.route.workload !== "agent" ||
        !/^chatgpt-web\/[a-z0-9_-]+$/.test(options.route.model)) {
      throw new RuntimeFault("INVALID_GROK_RUNTIME_ASSIGNMENT");
    }
    this.journal = new RunJournal(options.stateDirectory, {
      conversationId: options.conversationId, transcriptId: options.transcriptId
    });
  }

  isStarted(): boolean { return this.sessionId !== undefined; }

  async run(messages: unknown[], tools: unknown, invocationId: string | undefined, signal?: AbortSignal): Promise<RouterResult> {
    if (this.busy) throw new RuntimeFault("CONCURRENT_STREAM_REFUSED");
    if (this.failed) throw new RuntimeFault("UNKNOWN_RESEND_BLOCKED", true);
    if (this.finished) throw new RuntimeFault("COMPLETED_EXECUTOR_NO_REPLAY");
    if (!invocationId) throw new RuntimeFault("INVOCATION_ID_REQUIRED");
    if (signal?.aborted && !this.isStarted()) throw new RuntimeFault("CANCELLED_BEFORE_ADMISSION");
    this.busy = true;
    try {
      const mappedTools = dynamicTools(tools);
      const toolHash = fingerprint(mappedTools.definitions);
      if (this.toolFingerprint !== undefined && this.toolFingerprint !== toolHash) {
        throw new RuntimeFault("DYNAMIC_TOOL_SET_CHANGED");
      }
      if (this.consumedPrefixHash !== undefined &&
          transcriptFingerprint(messages.slice(0, this.consumedMessages)) !== this.consumedPrefixHash) {
        throw new RuntimeFault("TRANSCRIPT_PREFIX_CHANGED");
      }
      if (!this.isStarted()) {
        const input = initialRuntimeInput(messages);
        const status = await this.readStatus(true);
        const requestedToolIsolation = "dynamicOnly" as const;
        productionThreadPolicy.verify(status, requestedToolIsolation);
        this.sessionId = this.journal.begin(invocationId, this.options.executorOrdinal);
        const runtime = status.runtime as JsonObject;
        this.generation = count(runtime.generation);
        this.cursor = runtime.latest_event == null ? 0 : count(runtime.latest_event);
        this.journal.bind({ generation: this.generation });
        this.tools = mappedTools;
        this.toolFingerprint = toolHash;
        const opened = await this.mutate(`open_session:${this.sessionId}`, "runtime_session_open", {
          session_id: this.sessionId, model: this.options.route.model,
          sandbox: "read-only", approval_policy: "never",
          developer_instructions: input.developerInstructions, dynamic_tools: mappedTools.definitions,
          tool_isolation: requestedToolIsolation
        });
        if (opened.session_id !== this.sessionId) throw new RuntimeFault("SESSION_ID_MISMATCH", true);
        if (opened.tool_isolation !== requestedToolIsolation) {
          throw new RuntimeFault("TOOL_ISOLATION_ECHO_MISMATCH");
        }
        this.threadId = identifier(opened.thread_id, "THREAD_ID_MISSING");
        this.journal.bind({ threadId: this.threadId });
        if (signal?.aborted) return await this.closeWithoutTurn(invocationId);
        if (input.priorItems.length) {
          const injected = await this.mutate(`${this.sessionId}:inject`, "runtime_session_inject_items", {
            session_id: this.sessionId, operation_id: `${this.sessionId}:inject`, items: input.priorItems
          });
          this.assertSessionIdentity(injected);
          if (injected.operation_id !== `${this.sessionId}:inject` || injected.injected !== true) {
            throw new RuntimeFault("TRANSCRIPT_INJECT_ACK_MISMATCH", true);
          }
        }
        if (signal?.aborted) return await this.closeWithoutTurn(invocationId);
        this.turnOperationId = `${this.sessionId}:turn`;
        const started = await this.mutate(this.turnOperationId, "runtime_turn_start", {
          session_id: this.sessionId, operation_id: this.turnOperationId,
          model: this.options.route.model, effort: this.options.route.reasoningEffort,
          input_items: input.currentInput, summary: "auto"
        });
        this.assertSessionIdentity(started);
        if (started.operation_id !== this.turnOperationId) throw new RuntimeFault("OPERATION_ID_MISMATCH", true);
        this.turnId = identifier(started.turn_id, "TURN_ID_MISSING");
        this.journal.bind({ turnId: this.turnId });
        this.consumedMessages = messages.length;
        this.consumedPrefixHash = transcriptFingerprint(messages);
      } else if (this.pending.length && !signal?.aborted) {
        await this.replyToTools(messages);
      } else if (messages.length !== this.consumedMessages && !signal?.aborted) {
        throw new RuntimeFault("UNEXPECTED_MESSAGES_DURING_TURN");
      }
      return await this.observe(invocationId, signal);
    } catch (error) {
      this.failed = true;
      try { this.journal.fence(!(error instanceof RuntimeFault) || error.uncertain); }
      catch { /* The still-active durable owner prevents restart replay. Never send again. */ }
      throw error instanceof RuntimeFault ? error : new RuntimeFault("RUNTIME_EXECUTION_FAILED", true);
    } finally { this.busy = false; }
  }

  private assertSessionIdentity(value: JsonObject): void {
    if (value.session_id !== this.sessionId || value.thread_id !== this.threadId) {
      throw new RuntimeFault("SESSION_THREAD_MISMATCH", true);
    }
  }

  private async mutate(id: string, method: RuntimeTool, args: JsonObject): Promise<JsonObject> {
    this.journal.sent(id, method, args);
    let response: JsonObject;
    try {
      response = await this.options.boundary.call(method, args);
      if (response.ok !== true) throw new RuntimeFault("MALFORMED_RUNTIME_RESULT", true);
    } catch (error) {
      this.journal.settled(id, error instanceof RuntimeFault && !error.uncertain ? "REJECTED" : "UNKNOWN");
      throw error;
    }
    this.journal.settled(id, "ACK");
    return response;
  }

  private async readStatus(initial: boolean): Promise<JsonObject> {
    const value = await this.options.boundary.call("runtime_status", {});
    const runtime = value.runtime;
    const persistence = value.persistence;
    const capabilities = value.capabilities;
    if (value.ok !== true || !isRecord(runtime) || runtime.ready !== true || runtime.started !== true ||
        !isRecord(persistence) || persistence.state !== "healthy" || persistence.fenced !== false ||
        persistence.uncertain !== false) throw new RuntimeFault("RUNTIME_NOT_READY", !initial);
    if (!Array.isArray(runtime.unknown_operations) || runtime.unknown_operations.length) {
      throw new RuntimeFault("UNKNOWN_OUTCOME", true);
    }
    if (!isRecord(capabilities) || ["developer_instructions", "dynamic_tools", "inject_items", "structured_input", "reasoning_summary", "operation_result"]
      .some((name) => capabilities[name] !== true)) throw new RuntimeFault("RUNTIME_CAPABILITY_MISSING");
    if (!Array.isArray(runtime.pending_inputs)) throw new RuntimeFault("INVALID_PENDING_INPUTS", true);
    if (initial && runtime.pending_inputs.length) throw new RuntimeFault("RUNTIME_INPUT_PENDING");
    if (!initial && runtime.generation !== this.generation) throw new RuntimeFault("GENERATION_CHANGED_NO_REPLAY", true);
    if (!initial && runtime.pending_inputs.some((raw) => isRecord(raw) && raw.thread_id === this.threadId &&
        raw.method !== "item/tool/call")) throw new RuntimeFault("NATIVE_EXECUTION_REQUEST_FORBIDDEN", true);
    return value;
  }

  private async replyToTools(messages: unknown[]): Promise<void> {
    if (messages.length <= this.consumedMessages) throw new RuntimeFault("TOOL_RESULTS_MISSING");
    const incoming = hostToolResults(messages.slice(this.consumedMessages));
    // Grok may omit the assistant echo. It cannot replace an echo with different
    // content; the original exact pending call identities remain authoritative.
    if (incoming.assistantEchoes.length && (incoming.assistantEchoes.length !== this.echoHashes.length ||
        incoming.assistantEchoes.some((message, index) => transcriptFingerprint([message]) !== this.echoHashes[index]))) {
      throw new RuntimeFault("ASSISTANT_TOOL_ECHO_MISMATCH");
    }
    const byId = new Map(incoming.results.map((row) => [row.callId, row]));
    if (byId.size !== incoming.results.length || byId.size !== this.pending.length) {
      throw new RuntimeFault("DUPLICATE_OR_MISSING_TOOL_RESULT");
    }
    // Validate the ENTIRE result batch before replying to even the first call.
    for (const call of this.pending) {
      const result = byId.get(call.callId);
      if (!result || (result.name !== undefined && result.name !== call.hostTool)) {
        throw new RuntimeFault("TOOL_RESULT_IDENTITY_MISMATCH");
      }
    }
    for (const id of byId.keys()) if (!this.pending.some((call) => call.callId === id)) {
      throw new RuntimeFault("UNEXPECTED_TOOL_RESULT_CALL_ID");
    }
    const status = await this.readStatus(false);
    const currentPending = (status.runtime as JsonObject).pending_inputs as JsonObject[];
    for (const call of this.pending) {
      if (!currentPending.some((request) => request.request_id === call.requestId && request.generation === call.generation &&
          request.thread_id === this.threadId && request.turn_id === this.turnId && request.method === "item/tool/call")) {
        throw new RuntimeFault("PENDING_TOOL_CORRELATION_LOST", true);
      }
    }
    for (const call of this.pending) {
      const key = `${this.sessionId}:respond:${fingerprint([call.generation, call.requestId, call.callId])}`;
      const value = await this.mutate(key, "runtime_respond", {
        request_id: call.requestId, generation: call.generation, response: byId.get(call.callId)!.response
      });
      if (value.request_id !== call.requestId || value.generation !== call.generation || value.response_submitted !== true) {
        throw new RuntimeFault("TOOL_RESPONSE_ACK_MISMATCH", true);
      }
    }
    this.pending = [];
    this.echoHashes = [];
    this.journal.pending([]);
    this.consumedMessages = messages.length;
    this.consumedPrefixHash = transcriptFingerprint(messages);
  }

  private event(raw: unknown): RuntimeEvent {
    if (!isRecord(raw) || !Number.isSafeInteger(raw.sequence) || (raw.sequence as number) <= this.cursor ||
        raw.generation !== this.generation || typeof raw.method !== "string" ||
        raw.thread_id !== this.threadId || (raw.turn_id != null && raw.turn_id !== this.turnId)) {
      throw new RuntimeFault("EVENT_IDENTITY_OR_CURSOR_MISMATCH", true);
    }
    if (raw.known !== false) {
      if (!isRecord(raw.params)) throw new RuntimeFault("INVALID_EVENT_PARAMS", true);
      if (raw.params.threadId !== undefined && raw.params.threadId !== this.threadId) throw new RuntimeFault("EVENT_THREAD_MISMATCH", true);
      if (raw.params.turnId !== undefined && raw.params.turnId !== this.turnId) throw new RuntimeFault("EVENT_TURN_MISMATCH", true);
    }
    return raw as unknown as RuntimeEvent;
  }

  private toolCall(event: RuntimeEvent): PendingCall {
    const params = event.params;
    const callId = identifier(params.callId, "DYNAMIC_CALL_ID_MISSING");
    const tool = identifier(params.tool, "DYNAMIC_TOOL_NAME_MISSING");
    const hostTool = this.tools?.hostNames.get(tool);
    const requestId = event.request_id;
    if (!hostTool || params.namespace != null || params.threadId !== this.threadId || params.turnId !== this.turnId ||
        !(typeof requestId === "string" && requestId.length > 0 || Number.isSafeInteger(requestId))) {
      throw new RuntimeFault("DYNAMIC_CALL_IDENTITY_MISMATCH", true);
    }
    const requestKey = canonicalJson([event.generation, requestId]);
    if (this.seenCalls.has(callId) || this.seenRequests.has(requestKey)) throw new RuntimeFault("DUPLICATE_DYNAMIC_CALL", true);
    this.seenCalls.add(callId);
    this.seenRequests.add(requestKey);
    return { callId, requestId: requestId as string | number, generation: event.generation,
      tool, hostTool, arguments: params.arguments, argumentsSha256: fingerprint(params.arguments) };
  }

  private isAnsweredDynamicToolConfirmation(event: RuntimeEvent): boolean {
    if (event.method !== "engine/serverRequestResponded") return false;
    const requestId = event.request_id;
    const paramsRequestId = event.params.requestId;
    if (!(typeof requestId === "string" && requestId.length > 0 || Number.isSafeInteger(requestId)) ||
        paramsRequestId !== requestId || event.params.method !== "item/tool/call") {
      return false;
    }
    return this.seenRequests.has(canonicalJson([event.generation, requestId]));
  }

  private async observe(invocationId: string, signal?: AbortSignal): Promise<RouterResult> {
    const parts: StreamPart[] = [];
    let summary = "";
    while (true) {
      if (signal?.aborted && !this.cancellationRequested) {
        await this.cancel();
      }
      const batch = await this.options.boundary.call("runtime_events", {
        session_id: this.sessionId, after: this.cursor, limit: 500, wait_s: 1
      });
      if (batch.ok !== true || !Array.isArray(batch.events)) throw new RuntimeFault("MALFORMED_RUNTIME_EVENTS", true);
      let terminal: string | undefined;
      for (const raw of batch.events) {
        const event = this.event(raw);
        this.cursor = event.sequence;
        if (event.known === false) continue;
        const p = event.params;
        if (event.request_id != null && event.method !== "item/tool/call") {
          if (this.isAnsweredDynamicToolConfirmation(event)) continue;
          throw new RuntimeFault("NATIVE_EXECUTION_REQUEST_FORBIDDEN", true);
        }
        if (event.method === "item/tool/call") {
          if (this.cancellationRequested) continue; // Do not hand any cancelled request to Grok.
          this.pending.push(this.toolCall(event));
        } else if (event.method === "item/agentMessage/delta") {
          if (typeof p.delta !== "string") throw new RuntimeFault("INVALID_TEXT_DELTA", true);
          const itemId = identifier(p.itemId, "TEXT_ITEM_ID_REQUIRED");
          const previous = this.observedMessages.get(itemId) ?? { text: "", phase: undefined, complete: false };
          if (previous.complete) throw new RuntimeFault("TEXT_AFTER_COMPLETION", true);
          this.observedMessages.set(itemId, { ...previous, text: previous.text + p.delta });
          // The upstream PromptStreamResult already buffers each segment. Wait
          // for durable final selection instead of presenting commentary as an answer.
        } else if (event.method === "item/started" && isRecord(p.item) && p.item.type === "agentMessage") {
          const item = p.item;
          const itemId = identifier(item.id, "TEXT_ITEM_ID_REQUIRED");
          if (![undefined, null, "commentary", "final_answer"].includes(item.phase as string | undefined | null)) {
            throw new RuntimeFault("INVALID_MESSAGE_PHASE", true);
          }
          const previous = this.observedMessages.get(itemId);
          if (previous?.complete || (previous?.phase !== undefined && previous.phase !== item.phase)) {
            throw new RuntimeFault("MESSAGE_PHASE_CONFLICT", true);
          }
          this.observedMessages.set(itemId, { text: previous?.text ?? "", phase: item.phase, complete: false });
        } else if (event.method === "item/reasoning/summaryTextDelta") {
          if (typeof p.delta !== "string") throw new RuntimeFault("INVALID_SUMMARY_DELTA", true);
          summary += p.delta;
          parts.push({ type: "reasoning", textDelta: p.delta });
        } else if (event.method === "thread/tokenUsage/updated") {
          const tokenUsage = p.tokenUsage;
          if (!isRecord(tokenUsage) || !isRecord(tokenUsage.total)) throw new RuntimeFault("INVALID_USAGE", true);
          const total = tokenUsage.total;
          const next = { input: count(total.inputTokens), cached: count(total.cachedInputTokens),
            output: count(total.outputTokens), context: tokenUsage.modelContextWindow == null ? 0 : count(tokenUsage.modelContextWindow) };
          if (next.input < this.currentTokens.input || next.cached < this.currentTokens.cached || next.output < this.currentTokens.output) {
            throw new RuntimeFault("NONMONOTONIC_USAGE", true);
          }
          this.currentTokens = next;
        } else if (event.method === "item/completed" && isRecord(p.item) && p.item.type === "agentMessage") {
          const item = p.item;
          if (typeof item.text !== "string" || typeof item.id !== "string") throw new RuntimeFault("INVALID_COMPLETED_MESSAGE", true);
          if (![undefined, null, "commentary", "final_answer"].includes(item.phase as string | undefined | null)) {
            throw new RuntimeFault("INVALID_MESSAGE_PHASE", true);
          }
          const previous = this.observedMessages.get(item.id);
          if (previous?.text && item.text !== previous.text) throw new RuntimeFault("COMPLETED_TEXT_CONFLICT", true);
          if (previous?.phase !== undefined && previous.phase !== item.phase) throw new RuntimeFault("MESSAGE_PHASE_CONFLICT", true);
          this.observedMessages.set(item.id, { text: item.text, phase: item.phase, complete: true });
        } else if (event.method === "turn/completed") {
          if (!isRecord(p.turn) || p.turn.id !== this.turnId || !["completed", "interrupted", "failed"].includes(String(p.turn.status))) {
            throw new RuntimeFault("TERMINAL_TURN_MISMATCH", true);
          }
          if (terminal !== undefined) throw new RuntimeFault("DUPLICATE_TERMINAL_TURN", true);
          terminal = p.turn.status as string;
        }
        // In particular: raw reasoning text, rawResponseItem, and private
        // encrypted reasoning payloads are never emitted, logged, or retained.
      }
      if (batch.next_cursor !== this.cursor) throw new RuntimeFault("EVENT_CURSOR_MISMATCH", true);
      if (terminal !== undefined) {
        if (this.pending.length && terminal === "completed") throw new RuntimeFault("TERMINAL_WITH_UNANSWERED_TOOL", true);
        const operation = await this.options.boundary.call("runtime_operation_result", { operation_id: this.turnOperationId });
        const proof = operation.operation;
        if (operation.ok !== true || !isRecord(proof) || proof.operation_id !== this.turnOperationId ||
            proof.thread_id !== this.threadId || proof.turn_id !== this.turnId || proof.status !== "ACK" || proof.method !== "turn/start" ||
            proof.terminal_status !== terminal || proof.terminal_result_available !== true) {
          throw new RuntimeFault("TERMINAL_PROOF_MISMATCH", true);
        }
        const final = this.finalFromDurableProof(proof, terminal);
        if (final) parts.push({ type: "text-delta", textDelta: final });
        // Compute all potentially rejecting result/usage fields BEFORE releasing
        // the durable admission fence. A mapping error must not admit a new run.
        const result = this.result(parts, final, summary, invocationId, [], terminal === "completed" ? "stop" : "error");
        this.pending = [];
        this.journal.pending([]);
        await this.archive();
        this.journal.complete();
        this.finished = true;
        return result;
      }
      if (this.pending.length && !this.cancellationRequested) {
        this.journal.pending(this.pending.map(({ arguments: _arguments, ...identity }) => identity));
        const result = this.result(parts, "", summary, invocationId, this.pending, "tool-calls");
        const messages = result.response.messages as JsonObject[];
        this.echoHashes = messages.map((message) => transcriptFingerprint([message]));
        return result;
      }
      if (!batch.events.length) await this.readStatus(false);
    }
  }

  private finalFromDurableProof(proof: JsonObject, terminal: string): string {
    const durable = proof.terminal_result;
    if (!isRecord(durable)) throw new RuntimeFault("TERMINAL_RESULT_MISSING", true);
    const turn = isRecord(durable.turn) ? durable.turn : durable;
    if (turn.id !== this.turnId || turn.status !== terminal) throw new RuntimeFault("DURABLE_TURN_IDENTITY_MISMATCH", true);
    if (terminal !== "completed") return "";
    const items = [...(Array.isArray(durable.completedItems) ? durable.completedItems : []),
      ...(Array.isArray(turn.items) ? turn.items : [])].filter((item): item is JsonObject =>
        isRecord(item) && item.type === "agentMessage" && typeof item.text === "string" &&
        [undefined, null, "commentary", "final_answer"].includes(item.phase as string | undefined | null));
    // Select, do not concatenate. An explicitly blank final is authoritative;
    // commentary is never silently substituted for a final answer.
    const selected = items.findLast((item) => item.phase === "final_answer") ??
      items.findLast((item) => item.phase == null);
    if (!selected) return "";
    if (typeof selected.id === "string") {
      const observed = this.observedMessages.get(selected.id);
      if (observed?.complete && (observed.text !== selected.text ||
          (observed.phase ?? null) !== (selected.phase ?? null))) throw new RuntimeFault("DURABLE_FINAL_CONFLICT", true);
    }
    return selected.text as string;
  }

  private async cancel(): Promise<void> {
    if (!this.turnId || this.cancellationRequested) return;
    this.cancellationRequested = true;
    const id = `${this.sessionId}:cancel`;
    const value = await this.mutate(id, "runtime_turn_cancel", {
      session_id: this.sessionId, turn_id: this.turnId, operation_id: id
    });
    this.assertSessionIdentity(value);
    if (value.turn_id !== this.turnId || value.interrupt_requested !== true) throw new RuntimeFault("CANCEL_ACK_MISMATCH", true);
  }

  private async archive(): Promise<void> {
    const id = `${this.sessionId}:archive`;
    const value = await this.mutate(id, "runtime_session_archive", { session_id: this.sessionId, operation_id: id });
    this.assertSessionIdentity(value);
    if (value.archived !== true) throw new RuntimeFault("ARCHIVE_ACK_MISMATCH", true);
  }

  private async closeWithoutTurn(invocationId: string): Promise<RouterResult> {
    await this.archive();
    this.journal.complete();
    this.finished = true;
    return this.result([], "", "", invocationId, [], "error");
  }

  private result(parts: StreamPart[], text: string, summary: string, invocationId: string,
    calls: PendingCall[], finishReason: string): RouterResult {
    const toolParts = calls.map((call): StreamPart => ({
      type: "tool-call", toolCallId: call.callId, toolName: call.hostTool, args: call.arguments
    }));
    parts.push(...toolParts);
    const messages: JsonObject[] = [{ role: "assistant", content: calls.length
      ? [...(text ? [{ type: "text", text }] : []), ...toolParts] : text }];
    const response = { modelId: this.options.route.model, messages, finishReason };
    const normalized = usageDelta(this.currentTokens, this.reportedTokens);
    this.reportedTokens = { ...this.currentTokens };
    parts.push({ type: "finish", finishReason, usage: normalized.usage, response });
    return { parts, response, ...normalized,
      providerMetadata: { runtime: { threadId: this.threadId, turnId: this.turnId, generation: this.generation },
        ...(summary ? { reasoningSummary: summary } : {}) },
      invocationId, responseId: this.turnId, outputItems: [], reconstructedItems: [] };
  }
}
