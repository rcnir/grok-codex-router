import { spawn } from "node:child_process";
import path from "node:path";
import { isRecord, type JsonObject } from "./sand-values.js";

export const RUNTIME_SOCKET = "/run/rcnir-codex-runtime/mcp.sock";
export const RUNTIME_TOOLS = [
  "runtime_status", "runtime_models", "runtime_session_open",
  "runtime_session_status", "runtime_session_inject_items",
  "runtime_turn_start", "runtime_turn_cancel", "runtime_events",
  "runtime_operation_result", "runtime_respond", "runtime_session_archive"
] as const;
export type RuntimeTool = typeof RUNTIME_TOOLS[number];

/** No process startup, provider transport, authentication, retry, or replay. */
export interface RuntimeBoundary {
  call(name: RuntimeTool, args: JsonObject): Promise<JsonObject>;
}

export class RuntimeFault extends Error {
  readonly automaticRetry = false;
  constructor(readonly code: string, readonly uncertain = false) {
    super(code);
    this.name = "RuntimeFault";
  }
}

export interface RuntimeClientOptions {
  python: string;
  entrypoint: string;
  socket: string;
}

export function unwrapRuntimeResult(raw: unknown): JsonObject {
  if (!isRecord(raw)) throw new RuntimeFault("MALFORMED_RUNTIME_RESULT", true);
  let value: unknown = raw.structuredContent;
  if (!isRecord(value)) {
    const content = raw.content;
    if (!Array.isArray(content) || content.length !== 1 ||
        !isRecord(content[0]) || content[0].type !== "text" ||
        typeof content[0].text !== "string") {
      throw new RuntimeFault("MALFORMED_RUNTIME_RESULT", true);
    }
    try { value = JSON.parse(content[0].text); }
    catch { throw new RuntimeFault("MALFORMED_RUNTIME_RESULT", true); }
  }
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    throw new RuntimeFault("MALFORMED_RUNTIME_RESULT", true);
  }
  if (raw.isError === true || value.ok !== true) {
    // Provider messages, stderr, prompts and arguments must not escape diagnostics.
    const code = typeof value.code === "string" && /^[A-Z_0-9]+$/.test(value.code)
      ? value.code : "RUNTIME_REJECTED";
    throw new RuntimeFault(code, code === "UNKNOWN_OUTCOME" || value.persistence_uncertain === true);
  }
  return value;
}

export class LocalRuntimeClient implements RuntimeBoundary {
  constructor(private readonly options: RuntimeClientOptions) {
    if (options.socket !== RUNTIME_SOCKET ||
        !path.isAbsolute(options.python) || !path.isAbsolute(options.entrypoint) ||
        path.basename(options.entrypoint) !== "entrypoint.py") {
      throw new RuntimeFault("INVALID_RUNTIME_CLIENT_ASSIGNMENT");
    }
  }

  async call(name: RuntimeTool, args: JsonObject): Promise<JsonObject> {
    if (!(RUNTIME_TOOLS as readonly string[]).includes(name) || !isRecord(args)) {
      throw new RuntimeFault("INVALID_RUNTIME_TOOL");
    }
    const body = JSON.stringify(args);
    if (Buffer.byteLength(body) > 12 * 1024 * 1024) {
      throw new RuntimeFault("RUNTIME_REQUEST_TOO_LARGE");
    }
    const argv = ["-I", "-B", this.options.entrypoint, "client", "--socket",
      this.options.socket, "--name", name, "--arguments-stdin"];
    return new Promise<JsonObject>((resolve, reject) => {
      // Only the existing one-call Runtime client is launched. This is never
      // entrypoint daemon/serve, codex, a shell, or a new App Server.
      const child = spawn(this.options.python, argv, {
        shell: false, stdio: ["pipe", "pipe", "ignore"],
        env: { PATH: "/usr/bin:/bin", PYTHONDONTWRITEBYTECODE: "1" }
      });
      const chunks: Buffer[] = [];
      let bytes = 0;
      let settled = false;
      const fail = (code: string): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new RuntimeFault(code, true));
      };
      // A control RPC timeout is NOT a generation deadline. Killing this local
      // client never authorizes resending an ambiguous command.
      const timer = setTimeout(() => {
        fail("UNKNOWN_OUTCOME");
        child.kill("SIGTERM");
      }, 360_000);
      child.stdout.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 16 * 1024 * 1024) {
          fail("RUNTIME_RESULT_TOO_LARGE");
          child.kill("SIGTERM");
        } else chunks.push(chunk);
      });
      child.once("error", () => fail("RUNTIME_CLIENT_UNAVAILABLE"));
      child.stdin.once("error", () => fail("UNKNOWN_OUTCOME"));
      child.stdin.end(body, "utf8");
      child.once("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) return reject(new RuntimeFault("UNKNOWN_OUTCOME", true));
        try { resolve(unwrapRuntimeResult(JSON.parse(Buffer.concat(chunks).toString("utf8")))); }
        catch (error) {
          reject(error instanceof RuntimeFault ? error : new RuntimeFault("MALFORMED_RUNTIME_RESULT", true));
        }
      });
    });
  }
}
