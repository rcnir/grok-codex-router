import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { RuntimeExecution } from "../src/runtime-execution.js";
import { RuntimeFault, unwrapRuntimeResult, type RuntimeBoundary, type RuntimeTool } from "../src/runtime-client.js";
import { dynamicTools, hostToolResults, initialRuntimeInput } from "../src/runtime-wire.js";
import { productionThreadPolicy } from "../src/native-execution-policy.js";
import type { JsonObject } from "../src/sand-values.js";

const route = { workload: "agent" as const, agentId: "pilot", model: "chatgpt-web/extra-high", reasoningEffort: "xhigh" as const };
const definition = { name: "grok_lookup", description: "Fixture only", parameters: {
  type: "object", properties: { query: { type: "string" } }, required: ["query"]
} };
const user = [{ role: "system", content: "DEVELOPER_SHOULD_NOT_PERSIST" },
  { role: "user", content: "PROMPT_SHOULD_NOT_PERSIST" }];
const image = "data:image/png;base64,aGVsbG8=";

class FakeRuntime implements RuntimeBoundary {
  readonly calls: { name: RuntimeTool; args: JsonObject }[] = [];
  readonly queue: JsonObject[] = [];
  readonly pending = new Map<string, JsonObject>();
  session = "";
  thread = "thread-fixture";
  turn = "turn-fixture";
  operation = "";
  generation = 7;
  sequence = 0;
  terminalStatus = "completed";
  terminalItems: JsonObject[] = [];
  requiredReplies = 0;
  replies = 0;
  fault: RuntimeTool | undefined;
  faultCode = "UNKNOWN_OUTCOME";
  openToolIsolation: unknown = "dynamicOnly";
  alterStatus: ((status: JsonObject) => void) | undefined;
  onStart: (runtime: FakeRuntime) => void = (runtime) => runtime.complete();
  afterReplies: (runtime: FakeRuntime) => void = (runtime) => runtime.complete();
  onEmpty: (() => void) | undefined;

  emit(method: string, params: JsonObject, requestId?: string | number): void {
    const event: JsonObject = { sequence: ++this.sequence, generation: this.generation,
      method, params, thread_id: this.thread, turn_id: this.turn };
    if (requestId !== undefined) event.request_id = requestId;
    this.queue.push(event);
  }

  tool(callId = "call:EXACT/id", requestId: string | number = 42, tool = "grok_lookup"): void {
    const params = { threadId: this.thread, turnId: this.turn, callId, tool,
      arguments: { query: "ARGUMENT_SHOULD_NOT_PERSIST" }, namespace: null };
    this.emit("item/tool/call", params, requestId);
    this.pending.set(JSON.stringify(requestId), { request_id: requestId, generation: this.generation,
      method: "item/tool/call", thread_id: this.thread, turn_id: this.turn });
    this.requiredReplies++;
  }

  complete(status = "completed"): void {
    this.terminalStatus = status;
    this.terminalItems = [{ id: "final", type: "agentMessage", phase: "final_answer", text: "Final answer" }];
    this.emit("item/agentMessage/delta", { threadId: this.thread, turnId: this.turn, itemId: "final", delta: "Final answer" });
    this.emit("item/completed", { threadId: this.thread, turnId: this.turn,
      item: { id: "final", type: "agentMessage", phase: "final_answer", text: "Final answer" } });
    this.emit("thread/tokenUsage/updated", { threadId: this.thread, turnId: this.turn,
      tokenUsage: { total: { inputTokens: 100, cachedInputTokens: 40, outputTokens: 30, reasoningOutputTokens: 20, totalTokens: 130 },
        modelContextWindow: 272_000 } });
    this.emit("turn/completed", { threadId: this.thread, turn: { id: this.turn, status } });
  }

  async call(name: RuntimeTool, args: JsonObject): Promise<JsonObject> {
    this.calls.push({ name, args: structuredClone(args) });
    if (name === this.fault) throw new RuntimeFault(this.faultCode, true);
    if (name === "runtime_status") {
      const result: JsonObject = { ok: true, capabilities: { developer_instructions: true, dynamic_tools: true,
        inject_items: true, structured_input: true, reasoning_summary: true, operation_result: true,
        dynamic_only_tool_policy: true },
      persistence: { state: "healthy", fenced: false, uncertain: false },
      runtime: { started: true, ready: true, generation: this.generation, latest_event: this.sequence || null,
        unknown_operations: [], pending_inputs: [...this.pending.values()] } };
      this.alterStatus?.(result);
      return result;
    }
    if (name === "runtime_session_open") {
      this.session = String(args.session_id);
      return { ok: true, session_id: this.session, thread_id: this.thread,
        tool_isolation: this.openToolIsolation };
    }
    if (name === "runtime_session_inject_items") return { ok: true, session_id: this.session, thread_id: this.thread,
      operation_id: args.operation_id, injected: true };
    if (name === "runtime_turn_start") {
      this.operation = String(args.operation_id);
      this.onStart(this);
      return { ok: true, session_id: this.session, thread_id: this.thread, turn_id: this.turn,
        operation_id: this.operation, status: "inProgress" };
    }
    if (name === "runtime_events") {
      if (!this.queue.length) this.onEmpty?.();
      if (!this.queue.length && !this.onEmpty) throw new Error("Fixture exhausted; no live waiting is permitted");
      const events = this.queue.splice(0);
      return { ok: true, events, next_cursor: events.at(-1)?.sequence ?? args.after };
    }
    if (name === "runtime_respond") {
      const key = JSON.stringify(args.request_id);
      const pending = this.pending.get(key);
      assert.ok(pending, "must reply to a pending exact JSON-RPC request");
      assert.equal(args.generation, pending.generation);
      this.emit("engine/serverRequestResponded",
        { requestId: pending.request_id, method: "item/tool/call" }, pending.request_id as string | number);
      this.pending.delete(key);
      this.replies++;
      if (this.replies === this.requiredReplies) this.afterReplies(this);
      return { ok: true, request_id: args.request_id, generation: args.generation, response_submitted: true };
    }
    if (name === "runtime_operation_result") return { ok: true, operation: {
      operation_id: this.operation, method: "turn/start", status: "ACK", thread_id: this.thread,
      turn_id: this.turn, terminal_status: this.terminalStatus, terminal_result_available: true,
      terminal_result: { turn: { id: this.turn, status: this.terminalStatus, items: this.terminalItems } }
    } };
    if (name === "runtime_turn_cancel") {
      this.pending.clear();
      this.queue.length = 0;
      this.complete("interrupted");
      return { ok: true, session_id: this.session, thread_id: this.thread, turn_id: this.turn, interrupt_requested: true };
    }
    if (name === "runtime_session_archive") return { ok: true, session_id: this.session, thread_id: this.thread, archived: true };
    throw new Error(`Unexpected fixture call ${name}`);
  }
}

function fixture(t: TestContext, runtime = new FakeRuntime(), stateDirectory?: string, ordinal = 0): {
  runtime: FakeRuntime; execution: RuntimeExecution; directory: string;
} {
  const directory = stateDirectory ?? fs.mkdtempSync(path.join(os.tmpdir(), "grok-m1-runtime-"));
  if (!stateDirectory) t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const execution = new RuntimeExecution({ boundary: runtime, stateDirectory: directory,
    conversationId: "pilot", transcriptId: "transcript-fixture", executorOrdinal: ordinal, route });
  return { runtime, execution, directory };
}

function responseMessages(result: Awaited<ReturnType<RuntimeExecution["run"]>>): unknown[] {
  return result.response.messages as unknown[];
}

function resultMessage(callId = "call:EXACT/id", result: unknown = "TOOL_RESULT_SHOULD_NOT_PERSIST", isError = false): JsonObject {
  return { role: "tool", content: [{ type: "tool-result", toolCallId: callId, toolName: "grok_lookup", result, isError }] };
}

test("lazy thread, transcript injection, structured current user, final, official summary and usage", async (t) => {
  const { runtime, execution, directory } = fixture(t);
  assert.equal(runtime.calls.length, 0);
  runtime.onStart = (rt) => {
    rt.emit("item/reasoning/textDelta", { delta: "RAW_REASONING_MUST_NOT_APPEAR" });
    rt.emit("item/reasoning/summaryTextDelta", { delta: "Official summary" });
    rt.complete();
  };
  const transcript = [...user.slice(0, 1), { role: "user", content: "prior user" },
    { role: "assistant", content: "prior answer" }, { role: "user", content: [
      { type: "text", text: "PROMPT_SHOULD_NOT_PERSIST" }, { type: "image", image, mimeType: "image/png" }
    ] }];
  const result = await execution.run(transcript, [definition], "invocation-1");
  assert.equal(result.response.finishReason, "stop");
  assert.equal((result.response.messages as JsonObject[])[0]!.content, "Final answer");
  assert.equal(result.providerMetadata.reasoningSummary, "Official summary");
  assert.ok(!JSON.stringify(result).includes("RAW_REASONING"));
  assert.deepEqual(result.usage, { promptTokens: 100, completionTokens: 30, totalTokens: 130 });
  assert.deepEqual(result.extendedUsage, { inputTokens: 60, outputTokens: 30, cacheReadTokens: 40,
    cacheWriteTokens: 0, maxTokens: 272_000 });
  const open = runtime.calls.find((row) => row.name === "runtime_session_open")!;
  assert.equal(open.args.developer_instructions, "DEVELOPER_SHOULD_NOT_PERSIST");
  assert.equal(open.args.tool_isolation, "dynamicOnly");
  assert.equal((open.args.dynamic_tools as JsonObject[])[0]!.type, "function");
  assert.deepEqual((open.args.dynamic_tools as JsonObject[])[0]!.inputSchema, definition.parameters);
  assert.equal(runtime.calls.filter((row) => row.name === "runtime_session_inject_items").length, 1);
  const prior = runtime.calls.find((row) => row.name === "runtime_session_inject_items")!.args.items as JsonObject[];
  assert.equal(prior[0]!.type, "message");
  assert.equal(prior[0]!.role, "user");
  const start = runtime.calls.find((row) => row.name === "runtime_turn_start")!;
  assert.ok(!("text" in start.args));
  assert.deepEqual(start.args.input_items, [{ type: "text", text: "PROMPT_SHOULD_NOT_PERSIST" }, { type: "image", url: image, detail: "auto" }]);
  assert.equal(runtime.calls.filter((row) => row.name === "runtime_session_open").length, 1);
  assert.equal(runtime.calls.filter((row) => row.name === "runtime_session_archive").length, 1);
  const stored = fs.readFileSync(path.join(directory, fs.readdirSync(directory)[0]!), "utf8");
  assert.ok(!stored.includes("SHOULD_NOT_PERSIST"));
  await assert.rejects(execution.run(transcript, [definition], "invocation-2"), /COMPLETED_EXECUTOR_NO_REPLAY/);
});

for (const toolCount of [1, 2]) test(`${toolCount} dynamic call(s) continue the same Turn with exact callId/request_id/generation`, async (t) => {
  const { runtime, execution, directory } = fixture(t);
  runtime.onStart = (rt) => { rt.tool(); if (toolCount === 2) rt.tool("second/call:ID", "42"); };
  const first = await execution.run(user, [definition], "invocation-tools");
  assert.equal(first.response.finishReason, "tool-calls");
  const calls = first.parts.filter((part) => part.type === "tool-call");
  assert.equal(calls.length, toolCount);
  assert.equal(calls[0]!.toolCallId, "call:EXACT/id");
  const history = [...user, ...responseMessages(first), resultMessage()];
  if (toolCount === 2) history.push(resultMessage("second/call:ID", [{ type: "text", text: "screen" }, { type: "image", imageUrl: image }]));
  const final = await execution.run(history, [definition], "tool-return-invocation");
  assert.equal(final.response.finishReason, "stop");
  assert.equal(runtime.calls.filter((row) => row.name === "runtime_turn_start").length, 1);
  assert.equal(runtime.calls.filter((row) => row.name === "runtime_session_open").length, 1);
  const replies = runtime.calls.filter((row) => row.name === "runtime_respond");
  assert.deepEqual(replies.map((row) => [row.args.request_id, row.args.generation]), toolCount === 1 ? [[42, 7]] : [[42, 7], ["42", 7]]);
  if (toolCount === 2) assert.deepEqual((replies[1]!.args.response as JsonObject).contentItems,
    [{ type: "inputText", text: "screen" }, { type: "inputImage", imageUrl: image }]);
  assert.ok(!fs.readFileSync(path.join(directory, fs.readdirSync(directory)[0]!), "utf8").includes("SHOULD_NOT_PERSIST"));
});

test("failed Grok tool result keeps its failure and text in runtime_respond", async (t) => {
  const { runtime, execution } = fixture(t);
  runtime.onStart = (rt) => rt.tool();
  const first = await execution.run(user, [definition], "failed-result");
  await execution.run([...user, ...responseMessages(first), resultMessage("call:EXACT/id", "Fixture failure", true)], [definition], "reply");
  const reply = runtime.calls.find((row) => row.name === "runtime_respond")!;
  assert.deepEqual(reply.args.response, { success: false, contentItems: [{ type: "inputText", text: "Fixture failure" }] });
});

for (const mode of ["wrong-call-id", "duplicate-result", "wrong-name", "wrong-generation", "wrong-request-id", "changed-tools", "changed-echo"]) {
  test(`reject ${mode} before any dynamic tool response`, async (t) => {
    const { runtime, execution } = fixture(t);
    runtime.onStart = (rt) => rt.tool();
    const first = await execution.run(user, [definition], mode);
    const echo = responseMessages(first);
    let messages: unknown[] = [...user, ...echo, resultMessage()];
    let tools: unknown[] = [definition];
    if (mode === "wrong-call-id") messages = [...user, ...echo, resultMessage("other-id")];
    if (mode === "duplicate-result") messages.push(resultMessage());
    if (mode === "wrong-name") messages = [...user, ...echo, { role: "tool", toolCallId: "call:EXACT/id", toolName: "other", content: "x" }];
    if (mode === "wrong-generation") runtime.generation++;
    if (mode === "wrong-request-id") runtime.pending.set("42", { ...runtime.pending.get("42"), request_id: "42" });
    if (mode === "changed-tools") tools = [{ ...definition, description: "changed" }];
    if (mode === "changed-echo") messages = [...user, { role: "assistant", content: "injected" }, resultMessage()];
    await assert.rejects(execution.run(messages, tools, "reply"), RuntimeFault);
    assert.equal(runtime.calls.filter((row) => row.name === "runtime_respond").length, 0);
  });
}

for (const mode of ["duplicate-call-id", "duplicate-request-id", "wrong-thread", "wrong-turn", "native-tool", "unknown-tool"]) {
  test(`reject ${mode} in App Server events, never expose a Grok execution`, async (t) => {
    const { runtime, execution } = fixture(t);
    runtime.onStart = (rt) => {
      if (mode === "native-tool") rt.emit("item/commandExecution/requestApproval", {}, 88);
      else {
        rt.tool();
        if (mode === "duplicate-call-id") rt.tool("call:EXACT/id", 43);
        if (mode === "duplicate-request-id") rt.tool("other-call", 42);
        if (mode === "wrong-thread") (rt.queue[0]!.params as JsonObject).threadId = "not-ours";
        if (mode === "wrong-turn") (rt.queue[0]!.params as JsonObject).turnId = "not-ours";
        if (mode === "unknown-tool") (rt.queue[0]!.params as JsonObject).tool = "shell";
      }
    };
    await assert.rejects(execution.run(user, [definition], mode), RuntimeFault);
    assert.equal(runtime.calls.filter((row) => row.name === "runtime_respond").length, 0);
  });
}

test("cancellation interrupts exactly once and observes interrupted terminal before release", async (t) => {
  const { runtime, execution } = fixture(t);
  const abort = new AbortController();
  runtime.onStart = () => abort.abort();
  const result = await execution.run(user, [definition], "cancel", abort.signal);
  assert.equal(result.response.finishReason, "error");
  assert.equal(runtime.calls.filter((row) => row.name === "runtime_turn_cancel").length, 1);
  assert.equal(runtime.calls.filter((row) => row.name === "runtime_session_archive").length, 1);
});

test("cancellation while waiting for tool results does not execute or respond to them", async (t) => {
  const { runtime, execution } = fixture(t);
  runtime.onStart = (rt) => rt.tool();
  const first = await execution.run(user, [definition], "waiting-cancel");
  const abort = new AbortController(); abort.abort();
  await execution.run([...user, ...responseMessages(first)], [definition], "cancel", abort.signal);
  assert.equal(runtime.calls.filter((row) => row.name === "runtime_respond").length, 0);
  assert.equal(runtime.calls.filter((row) => row.name === "runtime_turn_cancel").length, 1);
});

for (const name of ["runtime_session_open", "runtime_session_inject_items", "runtime_turn_start", "runtime_respond", "runtime_turn_cancel"] as const) {
  test(`UNKNOWN ${name} is durable and never resent in-process or after restart`, async (t) => {
    const { runtime, execution, directory } = fixture(t);
    const messages = [user[0], { role: "user", content: "old" }, { role: "assistant", content: "old answer" }, user[1]];
    if (name === "runtime_respond") {
      runtime.onStart = (rt) => rt.tool();
      const first = await execution.run(messages, [definition], name);
      runtime.fault = name;
      await assert.rejects(execution.run([...messages, ...responseMessages(first), resultMessage()], [definition], "reply"), /UNKNOWN_OUTCOME/);
    } else if (name === "runtime_turn_cancel") {
      const abort = new AbortController();
      runtime.onStart = () => abort.abort();
      runtime.fault = name;
      await assert.rejects(execution.run(messages, [definition], name, abort.signal), /UNKNOWN_OUTCOME/);
    } else {
      runtime.fault = name;
      await assert.rejects(execution.run(messages, [definition], name), /UNKNOWN_OUTCOME/);
    }
    const sent = runtime.calls.filter((row) => row.name === name).length;
    await assert.rejects(execution.run(messages, [definition], "retry"), /UNKNOWN_RESEND_BLOCKED/);
    assert.equal(runtime.calls.filter((row) => row.name === name).length, sent);
    const restarted = fixture(t, new FakeRuntime(), directory, 3);
    await assert.rejects(restarted.execution.run(messages, [definition], "different-invocation"), /PENDING_RUN_NO_REPLAY/);
    assert.deepEqual(restarted.runtime.calls.map((row) => row.name), ["runtime_status"]);
    const stored = fs.readFileSync(path.join(directory, fs.readdirSync(directory).find((file) => file.endsWith(".json"))!), "utf8");
    assert.match(stored, /"phase":"UNKNOWN"/);
  });
}

test("restart with pending calls and new invocation cannot create another thread", async (t) => {
  const { runtime, execution, directory } = fixture(t);
  runtime.onStart = (rt) => rt.tool();
  await execution.run(user, [definition], "pending");
  const restarted = fixture(t, new FakeRuntime(), directory);
  await assert.rejects(restarted.execution.run(user, [definition], "fresh-id"), /PENDING_RUN_NO_REPLAY/);
  assert.equal(restarted.runtime.calls.some((row) => row.name === "runtime_session_open"), false);
});

test("completed invocation cannot be replayed through a replacement executor ordinal", async (t) => {
  const { execution, directory } = fixture(t);
  await execution.run(user, [definition], "completed");
  const replacement = fixture(t, new FakeRuntime(), directory, 42);
  await assert.rejects(replacement.execution.run(user, [definition], "completed"), /COMPLETED_RUN_NO_REPLAY/);
  assert.equal(replacement.runtime.calls.some((row) => row.name === "runtime_session_open"), false);
  const fresh = fixture(t, new FakeRuntime(), directory, 43);
  await fresh.execution.run(user, [definition], "genuinely-fresh");
  assert.equal(fresh.runtime.calls.filter((row) => row.name === "runtime_session_open").length, 1);
});

const memoryPrompt = (marker = "<<SAND_MEMORY_EXTRACTION>>", reason = "memory-extraction") => [
  { role: "system", content: marker + "\nMemory fixture instructions." },
  { role: "user", content: "Memory fixture exchange.",
    providerOptions: { cursor: { inferenceReason: reason } } }
];

test("root executor still requires an external invocation id for memory-shaped input", async (t) => {
  const { runtime, execution } = fixture(t);
  await assert.rejects(execution.run(memoryPrompt(), undefined, undefined), /INVOCATION_ID_REQUIRED/);
  assert.equal(runtime.calls.length, 0);
});

for (const marker of ["<<SAND_MEMORY_EXTRACTION>>", "<<SAND_MEMORY_EPISODE>>"]) {
  test("auxiliary " + marker + " inference gets a deterministic internal invocation id", async (t) => {
    const { runtime, execution } = fixture(t, new FakeRuntime(), undefined, 1);
    const result = await execution.run(memoryPrompt(marker), undefined, undefined);
    assert.match(String(result.invocationId), /^memory:1:[a-f0-9]{64}$/);
    assert.equal(runtime.calls.filter((row) => row.name === "runtime_session_open").length, 1);
  });
}

for (const mode of ["wrong-marker", "wrong-reason", "tools-present"]) {
  test("auxiliary invocation id synthesis rejects " + mode, async (t) => {
    const { runtime, execution } = fixture(t, new FakeRuntime(), undefined, 1);
    const messages = mode === "wrong-marker"
      ? memoryPrompt("<<NOT_MEMORY>>")
      : mode === "wrong-reason"
        ? memoryPrompt("<<SAND_MEMORY_EXTRACTION>>", "other")
        : memoryPrompt();
    const tools = mode === "tools-present" ? [] : undefined;
    await assert.rejects(execution.run(messages, tools, undefined), /INVOCATION_ID_REQUIRED/);
    assert.equal(runtime.calls.length, 0);
  });
}

test("production native policy requires verified Runtime capability and explicit dynamicOnly request", () => {
  const status = { capabilities: { dynamic_only_tool_policy: true } };
  assert.doesNotThrow(() => productionThreadPolicy.verify(status, "dynamicOnly"));
  assert.throws(() => productionThreadPolicy.verify(status, "default"), /NATIVE_TOOL_CONTRACT_UNVERIFIED/);
  assert.throws(() => productionThreadPolicy.verify({ capabilities: {} }, "dynamicOnly"), /NATIVE_TOOL_CONTRACT_UNVERIFIED/);
});

test("missing Runtime capabilities, unknown operations and pending inputs fail before session open", async (t) => {
  for (const mode of ["capability", "dynamic-policy", "legacy-policy", "unknown", "pending", "persistence"]) {
    const { runtime, execution } = fixture(t);
    runtime.alterStatus = (status) => {
      if (mode === "capability") (status.capabilities as JsonObject).inject_items = false;
      if (mode === "dynamic-policy") (status.capabilities as JsonObject).dynamic_only_tool_policy = false;
      if (mode === "legacy-policy") delete (status.capabilities as JsonObject).dynamic_only_tool_policy;
      if (mode === "unknown") (status.runtime as JsonObject).unknown_operations = ["unknown-operation"];
      if (mode === "pending") (status.runtime as JsonObject).pending_inputs = [{ request_id: 1 }];
      if (mode === "persistence") (status.persistence as JsonObject).fenced = true;
    };
    await assert.rejects(execution.run(user, [definition], mode), RuntimeFault);
    assert.equal(runtime.calls.some((row) => row.name === "runtime_session_open"), false);
  }
});

test("dynamicOnly open echo mismatch fails before turn admission", async (t) => {
  const { runtime, execution } = fixture(t);
  runtime.openToolIsolation = "default";
  await assert.rejects(execution.run(user, [definition], "policy-echo"), /TOOL_ISOLATION_ECHO_MISMATCH/);
  const open = runtime.calls.find((row) => row.name === "runtime_session_open");
  assert.equal(open?.args.tool_isolation, "dynamicOnly");
  assert.equal(runtime.calls.some((row) => row.name === "runtime_turn_start"), false);
});

test("wire rejects tool-name collisions, preserves raw call IDs, images and failure", () => {
  assert.throws(() => dynamicTools([{ ...definition, name: "a.b" }, { ...definition, name: "a_b" }]), /COLLISION/);
  assert.throws(() => initialRuntimeInput([{ role: "assistant", content: "no current user" }]), /CURRENT_USER_INPUT_REQUIRED/);
  assert.throws(() => initialRuntimeInput([{ role: "user", content: [{ type: "image", image: "file:///private/picture" }] }]), /IMAGE_SOURCE_UNAVAILABLE/);
  const mapped = hostToolResults([resultMessage("raw:id/with-punctuation", [{ type: "image", imageUrl: image }], true)]);
  assert.equal(mapped.results[0]!.callId, "raw:id/with-punctuation");
  assert.equal(mapped.results[0]!.response.success, false);
  assert.deepEqual(mapped.results[0]!.response.contentItems, [{ type: "inputImage", imageUrl: image }]);
});

test("Runtime MCP envelope unwrap never exposes provider messages or stderr", () => {
  assert.deepEqual(unwrapRuntimeResult({ structuredContent: { ok: true, value: 1 } }), { ok: true, value: 1 });
  assert.deepEqual(unwrapRuntimeResult({ content: [{ type: "text", text: '{"ok":true}' }] }), { ok: true });
  assert.throws(() => unwrapRuntimeResult({ isError: true, structuredContent: {
    ok: false, code: "UNKNOWN_OUTCOME", message: "PRIVATE_BODY"
  } }), (error) => error instanceof RuntimeFault && error.message === "UNKNOWN_OUTCOME" && error.uncertain);
  assert.throws(() => unwrapRuntimeResult({ content: [{ type: "text", text: "PRIVATE_BODY" }] }), /MALFORMED_RUNTIME_RESULT/);
});

test("commentary cannot replace an explicitly blank durable final answer", async (t) => {
  const { runtime, execution } = fixture(t);
  runtime.onStart = (rt) => {
    rt.emit("item/started", { item: { type: "agentMessage", id: "comment", phase: "commentary", text: "" } });
    rt.emit("item/agentMessage/delta", { itemId: "comment", delta: "THIS_IS_COMMENTARY" });
    rt.emit("item/completed", { item: { type: "agentMessage", id: "comment", phase: "commentary", text: "THIS_IS_COMMENTARY" } });
    rt.emit("item/completed", { item: { type: "agentMessage", id: "blank", phase: "final_answer", text: "" } });
    rt.terminalItems = [
      { type: "agentMessage", id: "comment", phase: "commentary", text: "THIS_IS_COMMENTARY" },
      { type: "agentMessage", id: "blank", phase: "final_answer", text: "" }
    ];
    rt.emit("turn/completed", { turn: { id: rt.turn, status: "completed" } });
  };
  const result = await execution.run(user, [], "blank-final");
  assert.equal((result.response.messages as JsonObject[])[0]!.content, "");
  assert.equal(result.parts.filter((part) => part.type === "text-delta").length, 0);
  assert.ok(!JSON.stringify(result).includes("THIS_IS_COMMENTARY"));
});

test("durable final works even when no message delta/completed notification was observed", async (t) => {
  const { runtime, execution } = fixture(t);
  runtime.onStart = (rt) => {
    rt.terminalItems = [{ id: "durable-only", type: "agentMessage", phase: "final_answer", text: "Durable final" }];
    rt.emit("turn/completed", { turn: { id: rt.turn, status: "completed", items: rt.terminalItems } });
  };
  const result = await execution.run(user, [], "durable-only");
  assert.equal((result.response.messages as JsonObject[])[0]!.content, "Durable final");
  assert.deepEqual(result.parts.filter((part) => part.type === "text-delta"), [{ type: "text-delta", textDelta: "Durable final" }]);
});

test("known=false text, tool and terminal events advance the cursor without semantic effects", async (t) => {
  const { runtime, execution } = fixture(t);
  runtime.onStart = (rt) => {
    rt.emit("item/agentMessage/delta", { itemId: "invalid", delta: "INVALID_TEXT" });
    rt.queue.at(-1)!.known = false;
    rt.emit("item/completed", { item: { id: "invalid", type: "agentMessage", text: "INVALID_TEXT", phase: "final_answer" } });
    rt.queue.at(-1)!.known = false;
    rt.emit("item/tool/call", { callId: "invalid", tool: "native" }, 44);
    rt.queue.at(-1)!.known = false;
    rt.emit("turn/completed", { turn: { id: "invalid", status: "completed" } });
    rt.queue.at(-1)!.known = false;
    rt.complete();
  };
  const result = await execution.run(user, [], "invalid-events");
  assert.equal((result.response.messages as JsonObject[])[0]!.content, "Final answer");
  assert.ok(!JSON.stringify(result).includes("INVALID_TEXT"));
  assert.equal(result.parts.filter((part) => part.type === "tool-call").length, 0);
});

test("tool replies may omit the assistant echo without injecting a new App Server turn", async (t) => {
  const { runtime, execution } = fixture(t);
  runtime.onStart = (rt) => rt.tool();
  await execution.run(user, [definition], "no-echo");
  const final = await execution.run([...user, resultMessage()], [definition], "reply");
  assert.equal(final.response.finishReason, "stop");
  assert.equal(runtime.calls.filter((row) => row.name === "runtime_turn_start").length, 1);
});

test("changed consumed history rejects before any reply even with correct pending call identity", async (t) => {
  const { runtime, execution } = fixture(t);
  runtime.onStart = (rt) => rt.tool();
  await execution.run(user, [definition], "prefix");
  await assert.rejects(execution.run([{ role: "system", content: "changed instructions" }, user[1], resultMessage()],
    [definition], "reply"), /TRANSCRIPT_PREFIX_CHANGED/);
  assert.equal(runtime.calls.filter((row) => row.name === "runtime_respond").length, 0);
});

test("host-only non-JSON metadata is excluded from transcript and assistant-echo fingerprints", async (t) => {
  const { runtime, execution } = fixture(t);
  runtime.onStart = (rt) => rt.tool();
  const initial = [
    { ...user[0], hostOnlyCallback: () => "ignored" },
    { ...user[1], hostOnlyCallback: () => "ignored" }
  ];
  const first = await execution.run(initial, [definition], "non-json-host-metadata");
  const echo = responseMessages(first) as JsonObject[];
  const echoed = echo.map((message) => ({ ...message, hostOnlyCallback: () => "ignored-again" }));
  const final = await execution.run([
    ...initial,
    ...echoed,
    { ...resultMessage(), hostOnlyCallback: () => "ignored-result" }
  ], [definition], "reply");
  assert.equal(final.response.finishReason, "stop");
  assert.equal(runtime.calls.filter((row) => row.name === "runtime_respond").length, 1);
});

for (const mode of ["wrong-confirmation-request-id", "wrong-confirmation-method", "unseen-confirmation-request"]) {
  test(`reject ${mode} as a native execution request`, async (t) => {
    const { runtime, execution } = fixture(t);
    runtime.onStart = (rt) => {
      if (mode === "wrong-confirmation-request-id") {
        rt.emit("engine/serverRequestResponded", { requestId: 43, method: "item/tool/call" }, 42);
      } else if (mode === "wrong-confirmation-method") {
        rt.emit("engine/serverRequestResponded", { requestId: 42, method: "item/commandExecution/requestApproval" }, 42);
      } else {
        rt.emit("engine/serverRequestResponded", { requestId: 42, method: "item/tool/call" }, 42);
      }
    };
    await assert.rejects(execution.run(user, [definition], mode), /NATIVE_EXECUTION_REQUEST_FORBIDDEN/);
  });
}

test("unrecognized current-user content part is not silently dropped", async (t) => {
  const { runtime, execution } = fixture(t);
  const messages = [{ role: "user", content: [{ type: "text", text: "visible" },
    { type: "audio", data: "would previously be lost" }] }];
  await assert.rejects(execution.run(messages, [], "unsupported-input"), /UNSUPPORTED_USER_INPUT/);
  assert.equal(runtime.calls.length, 0);
});

test("sequential dynamic calls share one turn and usage reports segment deltas without double counting", async (t) => {
  const { runtime, execution } = fixture(t);
  runtime.onStart = (rt) => {
    rt.emit("thread/tokenUsage/updated", { tokenUsage: {
      total: { inputTokens: 30, cachedInputTokens: 10, outputTokens: 5 }, modelContextWindow: 272_000
    } });
    rt.tool();
  };
  runtime.afterReplies = (rt) => {
    if (rt.replies === 1) {
      rt.emit("thread/tokenUsage/updated", { tokenUsage: {
        total: { inputTokens: 60, cachedInputTokens: 20, outputTokens: 15 }, modelContextWindow: 272_000
      } });
      rt.tool("second", "second-request");
    } else rt.complete();
  };
  const first = await execution.run(user, [definition], "sequence");
  const messages = [...user, resultMessage()];
  const second = await execution.run(messages, [definition], "reply-one");
  const final = await execution.run([...messages, resultMessage("second")], [definition], "reply-two");
  assert.equal(second.response.finishReason, "tool-calls");
  assert.equal(final.response.finishReason, "stop");
  assert.equal(first.usage.promptTokens + second.usage.promptTokens + final.usage.promptTokens, 100);
  assert.equal(first.usage.completionTokens + second.usage.completionTokens + final.usage.completionTokens, 30);
  assert.equal(first.extendedUsage.cacheReadTokens + second.extendedUsage.cacheReadTokens + final.extendedUsage.cacheReadTokens, 40);
  assert.equal(runtime.calls.filter((row) => row.name === "runtime_turn_start").length, 1);
});

test("prior transcript rejects unsupported content and preserves exact historical tool call IDs", async (t) => {
  const { runtime, execution } = fixture(t);
  const rawId = "exact-history:id/" + "long".repeat(40);
  const previous = [user[0], { role: "assistant", content: [
    { type: "reasoning", text: "", signature: "private-stock-signature",
      providerOptions: { cursor: { modelName: "cursor-grok-4.5-high-fast" } } },
    { type: "tool-call", toolCallId: rawId, toolName: "grok_lookup", args: { query: "old" } }
  ] }, { role: "tool", content: [{ type: "tool-result", toolCallId: rawId, result: "old answer" }] }, user[1]];
  await execution.run(previous, [definition], "history-tool");
  const items = runtime.calls.find((row) => row.name === "runtime_session_inject_items")!.args.items as JsonObject[];
  assert.equal(items[0]!.call_id, rawId);
  assert.equal(items[1]!.call_id, rawId);
  assert.equal(items.some((item) => item.type === "reasoning" || item.type === "thinking"), false);
  const invalid = fixture(t);
  await assert.rejects(invalid.execution.run([{ role: "user", content: [{ type: "audio", data: "old-unsupported" }] }, user[1]],
    [], "bad-history"), /UNSUPPORTED_TRANSCRIPT_CONTENT/);
  assert.equal(invalid.runtime.calls.length, 0);
  const privateUserReasoning = fixture(t);
  await assert.rejects(privateUserReasoning.execution.run([
    { role: "user", content: [{ type: "reasoning", text: "private" }] }, user[1]
  ], [], "bad-private-history"), /PRIVATE_REASONING_TRANSCRIPT_FORBIDDEN/);
  assert.equal(privateUserReasoning.runtime.calls.length, 0);
});
