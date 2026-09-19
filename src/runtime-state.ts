import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { RuntimeFault } from "./runtime-client.js";
import { isRecord } from "./sand-values.js";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (isRecord(value)) return "{" + Object.keys(value).sort().map((key) =>
    JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
  throw new RuntimeFault("NON_JSON_VALUE");
}

export function fingerprint(value: unknown): string {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export interface PendingToolIdentity {
  callId: string;
  requestId: string | number;
  generation: number;
  tool: string;
  hostTool: string;
  argumentsSha256: string;
}

interface MutationRecord {
  id: string;
  method: string;
  fingerprint: string;
  status: "SENT" | "ACK" | "UNKNOWN" | "REJECTED";
}

interface ActiveRun {
  owner: string;
  runHash: string;
  sessionId: string;
  phase: "ACTIVE" | "WAITING_TOOL" | "BLOCKED" | "UNKNOWN";
  threadId?: string;
  turnId?: string;
  generation?: number;
  pending: PendingToolIdentity[];
  operations: MutationRecord[];
}

interface Journal {
  version: 1;
  identityHash: string;
  active: ActiveRun | null;
  completed: string[];
}

/** Hashes and identities only. Prompt/tool/result payloads are never persisted. */
export class RunJournal {
  readonly owner = crypto.randomUUID();
  readonly identityHash: string;
  private readonly file: string;
  private readonly lock: string;
  private begun = false;

  constructor(private readonly directory: string, identity: { conversationId: string; transcriptId: string }) {
    if (!path.isAbsolute(directory)) throw new RuntimeFault("INVALID_STATE_DIRECTORY");
    this.identityHash = fingerprint(identity);
    this.file = path.join(directory, `${this.identityHash}.json`);
    this.lock = `${this.file}.lock`;
  }

  private transaction<T>(fn: (state: Journal) => T): T {
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const info = fs.lstatSync(this.directory);
    if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 ||
        (process.getuid && info.uid !== process.getuid())) {
      throw new RuntimeFault("UNSAFE_STATE_DIRECTORY");
    }
    try { fs.mkdirSync(this.lock, { mode: 0o700 }); }
    catch { throw new RuntimeFault("STATE_LOCKED_NO_RETRY"); }
    let temporary: string | undefined;
    try {
      let state: Journal = { version: 1, identityHash: this.identityHash, active: null, completed: [] };
      try {
        const metadata = fs.lstatSync(this.file);
        if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0) {
          throw new RuntimeFault("UNSAFE_STATE_FILE");
        }
        const raw: unknown = JSON.parse(fs.readFileSync(this.file, "utf8"));
        if (!isRecord(raw) || raw.version !== 1 || raw.identityHash !== this.identityHash ||
            !Array.isArray(raw.completed) || raw.completed.some((value) => typeof value !== "string") ||
            !(raw.active === null || isRecord(raw.active))) {
          throw new RuntimeFault("CORRUPT_STATE_NO_RETRY");
        }
        state = raw as unknown as Journal;
      } catch (error) {
        if (!(isRecord(error) && error.code === "ENOENT")) throw error;
      }
      const result = fn(state);
      temporary = `${this.file}.${crypto.randomUUID()}.tmp`;
      const fd = fs.openSync(temporary, "wx", 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(state)); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
      fs.renameSync(temporary, this.file);
      temporary = undefined;
      const dir = fs.openSync(this.directory, fs.constants.O_RDONLY);
      try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
      return result;
    } catch (error) {
      throw error instanceof RuntimeFault ? error : new RuntimeFault("STATE_PERSISTENCE_UNCERTAIN", true);
    } finally {
      if (temporary !== undefined) { try { fs.unlinkSync(temporary); } catch { /* evidence is retained on failure */ } }
      fs.rmdirSync(this.lock);
    }
  }

  begin(invocationId: string, executorOrdinal: number): string {
    if (this.begun) throw new RuntimeFault("EXECUTOR_ALREADY_ADMITTED");
    // An executor ordinal must not let a duplicate inference invocation evade
    // the transcript-wide completed-run fence after an executor replacement.
    const runHash = fingerprint({ invocationId });
    const sessionId = `grok:${this.identityHash.slice(0, 24)}:${runHash.slice(0, 24)}`;
    this.transaction((state) => {
      if (state.active !== null) throw new RuntimeFault("PENDING_RUN_NO_REPLAY", true);
      if (state.completed.includes(runHash)) throw new RuntimeFault("COMPLETED_RUN_NO_REPLAY");
      state.active = { owner: this.owner, runHash, sessionId, phase: "ACTIVE", pending: [], operations: [] };
    });
    this.begun = true;
    return sessionId;
  }

  private owned(state: Journal): ActiveRun {
    if (!this.begun || state.active?.owner !== this.owner) throw new RuntimeFault("RUN_OWNERSHIP_LOST", true);
    return state.active;
  }

  bind(fields: { threadId?: string; turnId?: string; generation?: number }): void {
    this.transaction((state) => {
      const active = this.owned(state);
      for (const [key, value] of Object.entries(fields)) {
        const previous = active[key as keyof ActiveRun];
        if (previous !== undefined && previous !== value) throw new RuntimeFault("RUN_IDENTITY_CONFLICT", true);
      }
      Object.assign(active, fields);
    });
  }

  sent(id: string, method: string, args: unknown): void {
    const digest = fingerprint(args);
    this.transaction((state) => {
      const active = this.owned(state);
      if (active.phase === "UNKNOWN" || active.phase === "BLOCKED") throw new RuntimeFault("UNKNOWN_RESEND_BLOCKED", true);
      if (active.operations.some((operation) => operation.id === id)) throw new RuntimeFault("OPERATION_RESEND_BLOCKED", true);
      active.operations.push({ id, method, fingerprint: digest, status: "SENT" });
    });
  }

  settled(id: string, outcome: "ACK" | "UNKNOWN" | "REJECTED"): void {
    this.transaction((state) => {
      const active = this.owned(state);
      const operation = active.operations.find((row) => row.id === id);
      if (operation?.status !== "SENT") throw new RuntimeFault("OPERATION_SETTLEMENT_CONFLICT", true);
      operation.status = outcome;
      if (outcome === "UNKNOWN") active.phase = "UNKNOWN";
      if (outcome === "REJECTED") active.phase = "BLOCKED";
    });
  }

  pending(tools: PendingToolIdentity[]): void {
    this.transaction((state) => {
      const active = this.owned(state);
      if (active.phase === "UNKNOWN" || active.phase === "BLOCKED") throw new RuntimeFault("UNKNOWN_RESEND_BLOCKED", true);
      active.pending = structuredClone(tools);
      active.phase = tools.length ? "WAITING_TOOL" : "ACTIVE";
    });
  }

  fence(uncertain: boolean): void {
    if (!this.begun) return;
    this.transaction((state) => { this.owned(state).phase = uncertain ? "UNKNOWN" : "BLOCKED"; });
  }

  complete(): void {
    this.transaction((state) => {
      const active = this.owned(state);
      if (active.pending.length || active.operations.some((row) => row.status !== "ACK") ||
          active.phase === "UNKNOWN" || active.phase === "BLOCKED") {
        throw new RuntimeFault("NONTERMINAL_RUN_NO_RELEASE", true);
      }
      state.completed.push(active.runHash);
      state.active = null;
    });
    this.begun = false;
  }
}
