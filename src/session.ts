import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig, resolveRoute, type ResolvedRoute, type SandSessionOptions } from "./config.js";
import { type NormalizedUsage, type RouterResult, type StreamPart } from "./response.js";
import { LocalRuntimeClient, RuntimeFault } from "./runtime-client.js";
import { RuntimeExecution } from "./runtime-execution.js";
import { shouldUseCodexRouter as matchesPilotPolicy } from "./pilot-policy.js";
import { isRecord } from "./sand-values.js";

interface SessionOptions {
  requestedModel?: unknown;
  onRequestId?: ((requestId: string | undefined) => void) | undefined;
  sessionOptions?: SandSessionOptions | undefined;
}

interface SandContext {
  signal?: AbortSignal | undefined;
}

export interface PromptStreamResult {
  fullStream: AsyncIterable<StreamPart>;
  response: Promise<Record<string, unknown>>;
  usage: Promise<NormalizedUsage["usage"]>;
  extendedUsage: Promise<NormalizedUsage["extendedUsage"]>;
  providerMetadata: Promise<Record<string, unknown>>;
  invocationId: Promise<string | undefined>;
}

export interface PromptExecutor {
  appendMessages(messages: unknown): PromptExecutor;
  getMessages(): unknown[];
  getState(): unknown[];
  clearMessages(): void;
  stream(ctx: SandContext | undefined, invocationId: string | undefined, tools: unknown): PromptStreamResult;
}

export interface CodexRouterSession {
  requestedModel: unknown;
  onRequestId?: ((requestId: string | undefined) => void) | undefined;
  sessionOptions: SandSessionOptions;
  route: ResolvedRoute;
  sessionId: string;
  nextExecutorOrdinal: number;
  getModelId(): string;
  getExecutor(initialMessages?: unknown): PromptExecutor;
}

function sessionIdFor(route: ResolvedRoute): string {
  const identity = route.agentId || crypto.randomUUID();
  return ("grok:" + identity + ":" + route.workload).slice(0, 64);
}

export function executorSessionIdFor(sessionId: string, ordinal: number): string {
  if (ordinal === 0) return sessionId;
  const suffix = ":aux:" + ordinal;
  return sessionId.slice(0, 64 - suffix.length) + suffix;
}

function emptyUsage(): NormalizedUsage {
  return {
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    extendedUsage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, maxTokens: 0 }
  };
}

export function errorResult(model: string, invocationId: string | undefined, error: unknown): RouterResult {
  const normalized = error instanceof Error ? error : new Error(String(error));
  const response = {
    modelId: model,
    messages: [{ role: "assistant", content: "" }],
    finishReason: "error"
  };
  const usage = emptyUsage();
  return {
    parts: [
      { type: "error", error: normalized },
      { type: "finish", finishReason: "error", usage: usage.usage, response }
    ],
    response,
    ...usage,
    providerMetadata: {},
    invocationId,
    responseId: undefined,
    outputItems: [],
    reconstructedItems: []
  };
}

function resultSurface(processing: Promise<RouterResult>, invocationId: string | undefined): PromptStreamResult {
  const fullStream = (async function* () {
    const result = await processing;
    for (const part of result.parts) yield part;
  })();
  return {
    fullStream,
    response: processing.then((result) => result.response),
    usage: processing.then((result) => result.usage),
    extendedUsage: processing.then((result) => result.extendedUsage),
    providerMetadata: processing.then((result) => result.providerMetadata),
    invocationId: processing.then((result) => result.invocationId || invocationId)
  };
}

export function createExecutor(
  session: CodexRouterSession,
  executorSessionId: string,
  initialMessages?: unknown
): PromptExecutor {
  const config = loadConfig();
  if (!config.runtime) throw new RuntimeFault("RUNTIME_CONFIGURATION_REQUIRED");
  const execution = new RuntimeExecution({
    boundary: new LocalRuntimeClient(config.runtime), stateDirectory: config.runtime.stateDirectory,
    conversationId: String(session.sessionOptions.conversationId || ""),
    transcriptId: String(session.sessionOptions.transcriptId || ""),
    executorOrdinal: executorSessionId === session.sessionId ? 0 : Number(executorSessionId.split(":aux:").at(-1)),
    route: session.route
  });
  const state = { messages: [] as unknown[] };
  if (initialMessages) {
    state.messages.push(...(Array.isArray(initialMessages) ? initialMessages : [initialMessages]));
  }
  return {
    appendMessages(messages: unknown) {
      state.messages.push(...(Array.isArray(messages) ? messages : messages == null ? [] : [messages]));
      return this;
    },
    getMessages() {
      return [...state.messages];
    },
    getState() {
      return [...state.messages];
    },
    clearMessages() {
      if (execution.isStarted()) throw new RuntimeFault("ACTIVE_EXECUTOR_CANNOT_CLEAR");
      state.messages = [];
    },
    stream(ctx: SandContext | undefined, invocationId: string | undefined, tools: unknown) {
      try { session.onRequestId && session.onRequestId(invocationId); } catch {}
      const processing = (async () => {
        try {
          return await execution.run([...state.messages], tools, invocationId, ctx?.signal);
        } catch (error) {
          return errorResult(session.route.model, invocationId, error);
        }
      })();
      return resultSurface(processing, invocationId);
    }
  };
}

export function isCodexRouterEnabled(): boolean {
  return loadConfig().enabled;
}

/** Only this exact allowlisted profile is read; Temporal and all other work stay stock. */
export function shouldUseCodexRouter(sessionOptions: SandSessionOptions = {}): boolean {
  try {
    const config = loadConfig();
    const agentId = sessionOptions.conversationId;
    if (!config.enabled || typeof agentId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(agentId) ||
        !config.pilot?.agentIds.includes(agentId)) return false;
    const root = process.env.SAND_DATA_ROOT || path.join(os.homedir(), "sand-data");
    const directory = path.join(root, "agents", agentId);
    if (fs.existsSync(path.join(directory, "group.json"))) return false;
    const profile: unknown = JSON.parse(fs.readFileSync(path.join(directory, "profile.json"), "utf8"));
    return isRecord(profile) && matchesPilotPolicy({
      enabled: config.enabled, allowlistedAgentIds: new Set(config.pilot.agentIds),
      executionHarness: profile.harness, sessionOptions
    });
  } catch { return false; }
}

export function createCodexRouterSession(options: SessionOptions = {}): CodexRouterSession {
  const config = loadConfig();
  const sessionOptions = options.sessionOptions || {};
  if (!shouldUseCodexRouter(sessionOptions)) throw new RuntimeFault("PILOT_NOT_ALLOWLISTED");
  const route = resolveRoute(config, sessionOptions);
  const session: CodexRouterSession = {
    requestedModel: options.requestedModel,
    onRequestId: options.onRequestId,
    sessionOptions,
    route,
    sessionId: sessionIdFor(route),
    nextExecutorOrdinal: 0,
    getModelId() {
      return this.route.model;
    },
    getExecutor(initialMessages) {
      const ordinal = session.nextExecutorOrdinal++;
      const executorSessionId = executorSessionIdFor(session.sessionId, ordinal);
      return createExecutor(session, executorSessionId, initialMessages);
    }
  };
  console.error(
    "[grok-codex-router] session agent=" + (route.agentId || "unidentified") +
    " workload=" + route.workload +
    " model=" + route.model +
    " effort=" + route.reasoningEffort
  );
  return session;
}
