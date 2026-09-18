import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { GROK_BOT_057_18CD065_MANIFEST } from "../scripts/manifests/grok-bot-0.57-18cd065.js";

const patcher = path.resolve(__dirname, "..", "scripts", "patch-host.js");
const SESSION_START = "/* GROK_CODEX_ROUTER_SESSION_START */";
const SESSION_END = "/* GROK_CODEX_ROUTER_SESSION_END */";
const IDENTITY_START = "/* GROK_CODEX_ROUTER_IDENTITY_START */";
const IDENTITY_END = "/* GROK_CODEX_ROUTER_IDENTITY_END */";

const ANCHORS_057 = {
  inferenceOwner: "function createCursorSandInference(options2) {",
  inferenceHook: "      return createCursorInferencePromptSession(inferenceOptions);",
  mainSessionOptions: [
    "        const mainSessionOptions = {",
    "          ...executorProfile === void 0 ? { modelId: host.subagentModelId } : { executorProfile },"
  ].join("\n"),
  mainSessionDispatch: "            async () => host.inference.createSession(emitRequestId, mainSessionOptions)"
};

function sha256(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function routerHook(): string {
  return [
    `      ${SESSION_START}`,
    '      const __grokCodexRouterHome = process.env.SAND_CODEX_ROUTER_HOME || require("path").join(require("os").homedir(), "grok-codex-router");',
    "      const { createCodexRouterSession, shouldUseCodexRouter } = require(__grokCodexRouterHome);",
    "      if (shouldUseCodexRouter(sessionOptions)) {",
    "        return createCodexRouterSession({",
    "          requestedModel,",
    "          onRequestId,",
    "          sessionOptions",
    "        });",
    "      }",
    `      ${SESSION_END}`
  ].join("\n");
}

function expectedPatched057(source: string): string {
  const firstLine = "        const mainSessionOptions = {";
  const secondLine = "          ...executorProfile === void 0 ? { modelId: host.subagentModelId } : { executorProfile },";
  const identity = [
    firstLine,
    `          ${IDENTITY_START}`,
    "          conversationId,",
    "          transcriptId: host.getTranscriptId(),",
    "          isGroupMemberTurn: options2.isGroupMemberTurn === true,",
    `          ${IDENTITY_END}`,
    secondLine
  ].join("\n");
  return source
    .replace(ANCHORS_057.inferenceHook, `${routerHook()}\n${ANCHORS_057.inferenceHook}`)
    .replace(ANCHORS_057.mainSessionOptions, identity);
}

function stock057Fixture(): string {
  return [
    "function resolveSandRequestedModel({ sessionOptions }) { return sessionOptions?.modelId ?? 'stock-model'; }",
    "function createCursorInferencePromptSession(options) { return { provider: 'stock', options, getModelId: () => options.requestedModel }; }",
    "function createCursorSandInference(options2) {",
    "  return {",
    "    createSession(onRequestId, sessionOptions) {",
    "      const requestedModel = resolveSandRequestedModel({ sessionOptions });",
    "      const inferenceOptions = {",
    "        backend: options2.backend,",
    "        getAccessToken: options2.getAccessToken,",
    "        getGrokBotAccessToken: options2.getGrokBotToken,",
    "        getTeamId: options2.getTeamId,",
    "        getMachineId: options2.getMachineId,",
    "        requestedModel,",
    "        onRequestId",
    "      };",
    "      return createCursorInferencePromptSession(inferenceOptions);",
    "    }",
    "  };",
    "}",
    "async function buildMainSessionOptions(host, options2, turnRequestSource = 'main') {",
    "      const conversationId = host.getConversationId();",
    "      const existingUnrelatedIdentity = {",
    "          conversationId,",
    "          requestSource: turnRequestSource",
    "      };",
    "      void existingUnrelatedIdentity;",
    "      const emitRequestId = () => {};",
    "      const runCtx = {};",
    "      const executorProfile = host.subagentType === 'executor' ? host.subagentModelId : void 0;",
    "        const mainSessionOptions = {",
    "          ...executorProfile === void 0 ? { modelId: host.subagentModelId } : { executorProfile },",
    "          inferenceReason: void 0,",
    "          isSubagent: host.isSubagentRunner,",
    "          isComputerUseSubagent: host.isComputerUseSubagent,",
    "          isBrowserUseSubagent: host.isBrowserUseSubagent,",
    "          requestSource: turnRequestSource,",
    "          skipLabeling: false",
    "        };",
    "      const traceSendPhase = async (_ctx, _name, callback) => callback();",
    "      await traceSendPhase(",
    "            runCtx,",
    "            'inference.createSession',",
    "            async () => host.inference.createSession(emitRequestId, mainSessionOptions)",
    "          );",
    "      return mainSessionOptions;",
    "}",
    "module.exports = { createCursorSandInference, buildMainSessionOptions };",
    ""
  ].join("\n");
}

function write057Manifest(file: string, source: string, anchors: Record<string, string> = ANCHORS_057): void {
  const stock = Buffer.from(source, "utf8");
  const patched = Buffer.from(expectedPatched057(source), "utf8");
  fs.writeFileSync(file, JSON.stringify({
    grokBotVersion: "0.57-fixture",
    hostVersion: "18cd065-fixture",
    hostPath: "/fixture/host-main.cjs",
    anchorProof: "VERIFIED",
    routerMarkerVersion: 1,
    stockHost: { bytes: stock.length, sha256: sha256(stock) },
    deterministicPatchedHost: { bytes: patched.length, sha256: sha256(patched) },
    pristineBackup: { sha256: sha256(stock), mode: 0o600 },
    anchors,
    requiredAnchorCounts: Object.fromEntries(Object.keys(anchors).map((name) => [name, 1]))
  }));
}

function with057Fixture(run: (paths: {
  root: string; host: string; backup: string; manifest: string; source: string;
}) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "grok-codex-router-057-"));
  const host = path.join(root, "host-main.cjs");
  const backup = path.join(root, "host-main.cjs.stock");
  const manifest = path.join(root, "manifest.json");
  const source = stock057Fixture();
  fs.writeFileSync(host, source);
  write057Manifest(manifest, source);
  try { run({ root, host, backup, manifest, source }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function runPatcher(host: string, backup: string, manifest: string, ...args: string[]) {
  return spawnSync(process.execPath, [
    patcher, "--host", host, "--backup", backup, "--manifest", manifest, ...args
  ], { encoding: "utf8" });
}

test("0.57 production manifest is fingerprint-bound after fresh live structural proof", () => {
  assert.equal(GROK_BOT_057_18CD065_MANIFEST.grokBotVersion, "0.57.0");
  assert.equal(GROK_BOT_057_18CD065_MANIFEST.hostVersion, "18cd065");
  assert.equal(GROK_BOT_057_18CD065_MANIFEST.anchorProof, "VERIFIED");
  assert.equal(GROK_BOT_057_18CD065_MANIFEST.routerMarkerVersion, 1);
  assert.equal(GROK_BOT_057_18CD065_MANIFEST.stockHost.bytes, 26_438_264);
  assert.equal(GROK_BOT_057_18CD065_MANIFEST.stockHost.sha256,
    "c667b530962bbf94a2ba77659b0440f20dd553dfdbabdd4a2cd157e4335bba29");
  assert.deepEqual(GROK_BOT_057_18CD065_MANIFEST.deterministicPatchedHost, {
    bytes: 26_439_011,
    sha256: "07835cd847c027aa2628741c2fb93a7c2ebbcb67a55c4861254dfc51af522b1d"
  });
  assert.deepEqual(GROK_BOT_057_18CD065_MANIFEST.requiredAnchorCounts, {
    inferenceOwner: 1, inferenceHook: 1, mainSessionOptions: 1, mainSessionDispatch: 1
  });
});

test("0.57 exact-shape fixture checks stock, inserts one hook and identity, and is idempotent", () => {
  with057Fixture(({ host, backup, manifest, source }) => {
    const before = fs.readFileSync(host);
    const check = runPatcher(host, backup, manifest, "--check");
    assert.equal(check.status, 0, check.stderr);
    assert.match(check.stdout, /state=stock/);
    assert.deepEqual(fs.readFileSync(host), before);
    assert.equal(fs.existsSync(backup), false);

    const install = runPatcher(host, backup, manifest);
    assert.equal(install.status, 0, install.stderr);
    const patched = fs.readFileSync(host, "utf8");
    assert.equal(patched, expectedPatched057(source));
    for (const marker of [SESSION_START, SESSION_END, IDENTITY_START, IDENTITY_END]) {
      assert.equal(patched.split(marker).length - 1, 1, marker);
    }
    assert.equal(patched.split("          conversationId,").length - 1, 2);
    assert.equal(patched.split("          transcriptId: host.getTranscriptId(),").length - 1, 1);
    assert.equal(patched.split("          isGroupMemberTurn: options2.isGroupMemberTurn === true,").length - 1, 1);
    assert.equal(fs.readFileSync(backup, "utf8"), source);
    assert.equal(fs.statSync(backup).mode & 0o777, 0o600);

    const checkPatched = runPatcher(host, backup, manifest, "--check");
    assert.equal(checkPatched.status, 0, checkPatched.stderr);
    assert.match(checkPatched.stdout, /state=patched/);
    const again = runPatcher(host, backup, manifest);
    assert.equal(again.status, 0, again.stderr);
    assert.match(again.stdout, /^already-installed:/);
    assert.equal(fs.readFileSync(host, "utf8"), patched);
  });
});

test("0.57 exact-shape fixture fails closed on size, SHA, anchors, partial markers, and backup mismatch", () => {
  with057Fixture(({ host, backup, manifest, source }) => {
    fs.appendFileSync(host, "x");
    assert.match(runPatcher(host, backup, manifest, "--check").stderr, /byte size/);

    fs.writeFileSync(host, source.replace("stock-model", "stock-modem"));
    assert.equal(fs.statSync(host).size, Buffer.byteLength(source));
    assert.match(runPatcher(host, backup, manifest, "--check").stderr, /SHA-256/);

    const missing = source.replace(ANCHORS_057.inferenceHook, "      return nativeFallback(inferenceOptions);");
    fs.writeFileSync(host, missing);
    write057Manifest(manifest, missing);
    const raw = JSON.parse(fs.readFileSync(manifest, "utf8"));
    raw.anchors.inferenceHook = ANCHORS_057.inferenceHook;
    fs.writeFileSync(manifest, JSON.stringify(raw));
    assert.match(runPatcher(host, backup, manifest, "--check").stderr, /inferenceHook occurred 0 times/);

    fs.writeFileSync(host, source);
    write057Manifest(manifest, source);
    assert.equal(runPatcher(host, backup, manifest).status, 0);
    fs.writeFileSync(host, fs.readFileSync(host, "utf8").replace(SESSION_END, ""));
    assert.match(runPatcher(host, backup, manifest, "--check").stderr, /partial or duplicated/);

    fs.writeFileSync(host, source);
    fs.writeFileSync(backup, source.replace("stock-model", "stock-modem"));
    fs.chmodSync(backup, 0o600);
    assert.match(runPatcher(host, backup, manifest, "--check").stderr, /stock backup SHA-256/);
  });
});

test("0.57 exact-shape fixture enforces zero-or-duplicate failure for every required anchor", () => {
  for (const [name, anchor] of Object.entries(ANCHORS_057)) {
    with057Fixture(({ host, backup, manifest, source }) => {
      const missing = source.replace(anchor, `/* missing ${name} */`);
      fs.writeFileSync(host, missing);
      write057Manifest(manifest, missing);
      assert.match(runPatcher(host, backup, manifest, "--check").stderr,
        new RegExp(`${name} occurred 0 times`));
      assert.equal(fs.existsSync(backup), false);
    });
    with057Fixture(({ host, backup, manifest, source }) => {
      const duplicated = source.replace(anchor, `${anchor}\n${anchor}`);
      fs.writeFileSync(host, duplicated);
      write057Manifest(manifest, duplicated);
      assert.match(runPatcher(host, backup, manifest, "--check").stderr,
        new RegExp(`${name} occurred 2 times`));
      assert.equal(fs.existsSync(backup), false);
    });
  }
});

test("0.57 patched fallback routes only allowlisted BOX root work and preserves all stock passthroughs", () => {
  with057Fixture(({ root, host, backup, manifest }) => {
    const routerHome = path.join(root, "router");
    const dataRoot = path.join(root, "sand-data");
    fs.mkdirSync(routerHome);
    fs.mkdirSync(path.join(dataRoot, "agents", "allowlisted-agent"), { recursive: true });
    fs.writeFileSync(path.join(dataRoot, "agents", "allowlisted-agent", "profile.json"), JSON.stringify({ harness: "box" }));
    fs.writeFileSync(path.join(routerHome, "index.js"), [
      "const fs=require('fs'),path=require('path');",
      "module.exports.shouldUseCodexRouter = options => {",
      "  const flags=['isSummarizationSession','isComputerUseSubagent','isBrowserUseSubagent','isSubagent','isGroupMemberTurn'];",
      "  if (options?.conversationId !== 'allowlisted-agent' || flags.some(k => typeof options?.[k] !== 'boolean' || options[k])) return false;",
      "  if (typeof options.requestSource !== 'string' || !options.requestSource || options.requestSource.toLowerCase().includes('automation')) return false;",
      "  try { return JSON.parse(fs.readFileSync(path.join(process.env.SAND_DATA_ROOT,'agents',options.conversationId,'profile.json'),'utf8')).harness === 'box'; } catch { return false; }",
      "};",
      "module.exports.createCodexRouterSession = options => ({ provider: 'router', options });",
      ""
    ].join("\n"));
    assert.equal(runPatcher(host, backup, manifest).status, 0);

    const exercise = spawnSync(process.execPath, ["-e", [
      `const h=require(${JSON.stringify(host)});`,
      "const inf=h.createCursorSandInference({});",
      "const base={conversationId:'allowlisted-agent',transcriptId:'t',isSummarizationSession:false,isComputerUseSubagent:false,isBrowserUseSubagent:false,isSubagent:false,isGroupMemberTurn:false,requestSource:'main'};",
      "const routed=inf.createSession(()=>{},base);",
      "const other=inf.createSession(()=>{},{...base,conversationId:'other-agent'});",
      "const workloads=['isSummarizationSession','isComputerUseSubagent','isBrowserUseSubagent','isSubagent','isGroupMemberTurn'].map(k=>inf.createSession(()=>{},{...base,[k]:true}).provider);",
      "const automation=inf.createSession(()=>{},{...base,requestSource:'scheduled-automation'}).provider;",
      "require('fs').writeFileSync(require('path').join(process.env.SAND_DATA_ROOT,'agents','allowlisted-agent','profile.json'),JSON.stringify({harness:'temporal'}));",
      "const temporal=inf.createSession(()=>{},base).provider;",
      "const hostObj={subagentType:'main',subagentModelId:'model',isSubagentRunner:false,isComputerUseSubagent:false,isBrowserUseSubagent:false,getConversationId:()=> 'allowlisted-agent',getTranscriptId:()=> 'transcript-main',inference:{createSession:()=>({})}};",
      "h.buildMainSessionOptions(hostObj,{isGroupMemberTurn:false}).then(options=>console.log(JSON.stringify({routed:routed.provider,other:other.provider,workloads,automation,temporal,options})));"
    ].join("\n")], {
      encoding: "utf8",
      env: { ...process.env, SAND_CODEX_ROUTER_HOME: routerHome, SAND_DATA_ROOT: dataRoot }
    });
    assert.equal(exercise.status, 0, exercise.stderr);
    const result = JSON.parse(exercise.stdout);
    assert.equal(result.routed, "router");
    assert.equal(result.other, "stock");
    assert.deepEqual(result.workloads, ["stock", "stock", "stock", "stock", "stock"]);
    assert.equal(result.automation, "stock");
    assert.equal(result.temporal, "stock");
    assert.deepEqual(result.options, {
      conversationId: "allowlisted-agent",
      transcriptId: "transcript-main",
      isGroupMemberTurn: false,
      modelId: "model",
      isSubagent: false,
      isComputerUseSubagent: false,
      isBrowserUseSubagent: false,
      requestSource: "main",
      skipLabeling: false
    });
  });
});
