import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { DEFAULT_CONFIG, M1_PILOT_AGENT_ID, writeConfig, type RouterConfig } from "../src/config.js";
import { createCodexRouterSession, shouldUseCodexRouter } from "../src/session.js";

const options = { conversationId: M1_PILOT_AGENT_ID, transcriptId: "transcript",
  isSubagent: false, isComputerUseSubagent: false,
  isBrowserUseSubagent: false, isGroupMemberTurn: false, requestSource: "user" };

test("root entrypoint imports no private provider transport, OAuth or control bootstrap", () => {
  const loaded = Object.keys(require.cache).filter((file) => /[\\/]src[\\/](oauth|transport|turn-execution|control-service)\.js$/.test(file));
  assert.deepEqual(loaded, []);
});

test("only explicit pilot IDs and lowercase BOX profile opt in; all native workloads remain stock", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "grok-m1-policy-entry-"));
  const previous = process.env.SAND_DATA_ROOT;
  process.env.SAND_DATA_ROOT = root;
  t.after(() => { if (previous === undefined) delete process.env.SAND_DATA_ROOT; else process.env.SAND_DATA_ROOT = previous;
    fs.rmSync(root, { recursive: true, force: true }); });
  const config: RouterConfig = structuredClone(DEFAULT_CONFIG);
  config.enabled = true;
  config.pilot = { agentIds: [M1_PILOT_AGENT_ID] };
  config.agents = { [M1_PILOT_AGENT_ID]: { model: "chatgpt-web/extra-high", reasoningEffort: "xhigh" },
    other: { model: "chatgpt-web/extra-high", reasoningEffort: "xhigh" } };
  config.runtime = { python: "/not-invoked/python", entrypoint: "/not-invoked/entrypoint.py",
    socket: "/run/rcnir-codex-runtime/mcp.sock", stateDirectory: path.join(root, "journal") };
  writeConfig(config);
  for (const id of [M1_PILOT_AGENT_ID, "other"]) {
    fs.mkdirSync(path.join(root, "agents", id), { recursive: true });
    fs.writeFileSync(path.join(root, "agents", id, "profile.json"), JSON.stringify({ harness: "box" }));
  }
  assert.equal(shouldUseCodexRouter(options), true);
  assert.equal(shouldUseCodexRouter({ ...options, isSummarizationSession: false }), true);
  assert.equal(shouldUseCodexRouter({ ...options, conversationId: "other" }), false);
  for (const flag of ["isSummarizationSession", "isSubagent", "isComputerUseSubagent", "isBrowserUseSubagent", "isGroupMemberTurn"]) {
    assert.equal(shouldUseCodexRouter({ ...options, [flag]: true }), false, flag);
  }
  assert.equal(shouldUseCodexRouter({ ...options, requestSource: "automation" }), false);
  assert.equal(shouldUseCodexRouter({ ...options, transcriptId: undefined }), false);
  assert.equal(shouldUseCodexRouter({ ...options, conversationId: "../pilot" }), false);
  const session = createCodexRouterSession({ sessionOptions: options });
  const executor = session.getExecutor([{ role: "user", content: "local only" }]);
  assert.equal(executor.getMessages().length, 1);
  assert.equal(fs.existsSync(path.join(root, "journal")), false, "session/executor construction is lazy and never invokes the Runtime");
  fs.writeFileSync(path.join(root, "agents", M1_PILOT_AGENT_ID, "profile.json"), JSON.stringify({ harness: "temporal" }));
  assert.equal(shouldUseCodexRouter(options), false);
  assert.throws(() => createCodexRouterSession({ sessionOptions: options }), /PILOT_NOT_ALLOWLISTED/);
});

test("retained install/recover/verify/on verbs cannot call a provider, restart or write a config", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "grok-m1-cli-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cli = path.resolve(__dirname, "..", "bin", "grok-codex-router.js");
  for (const command of ["install", "recover", "verify", "on", "restart-host", "control"]) {
    const result = spawnSync(process.execPath, [cli, command], { encoding: "utf8",
      env: { ...process.env, SAND_DATA_ROOT: root } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /HUMAN_GATE_CLOSED_HOST_COMPATIBILITY_UNVERIFIED/);
    assert.deepEqual(fs.readdirSync(root), []);
  }
  const installer = path.resolve(__dirname, "..", "..", "install.sh");
  const install = spawnSync("bash", [installer], { encoding: "utf8", env: { ...process.env, SAND_DATA_ROOT: root } });
  assert.equal(install.status, 2);
  assert.match(install.stderr, /HUMAN_GATE_CLOSED/);
  assert.deepEqual(fs.readdirSync(root), []);
});
