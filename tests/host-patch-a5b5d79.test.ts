import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { M1_PILOT_AGENT_ID } from "../src/config.js";
import { GROK_BOT_057_A5B5D79_MANIFEST } from "../scripts/manifests/grok-bot-0.57-a5b5d79.js";

const patcher = path.resolve(__dirname, "..", "scripts", "patch-host.js");
const SESSION_START = "/* GROK_CODEX_ROUTER_SESSION_START */";
const SESSION_END = "/* GROK_CODEX_ROUTER_SESSION_END */";
const IDENTITY_START = "/* GROK_CODEX_ROUTER_IDENTITY_START */";
const IDENTITY_END = "/* GROK_CODEX_ROUTER_IDENTITY_END */";

const ANCHORS_A5B5D79 = {
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

function expectedPatcheda5b5d79(source: string): string {
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
    .replace(ANCHORS_A5B5D79.inferenceHook, `${routerHook()}\n${ANCHORS_A5B5D79.inferenceHook}`)
    .replace(ANCHORS_A5B5D79.mainSessionOptions, identity);
}

function stocka5b5d79Fixture(): string {
  return [
    "function resolveSandRequestedModel({ sessionOptions }) { return sessionOptions?.modelId ?? 'stock-model'; }",
    "function createCursorInferencePromptSession(options) { return { provider: 'stock', options, getModelId: () => options.requestedModel }; }",
    "function createCursorSandInference(options2) {",
    "  return {",
    "    createSession(onRequestId, sessionOptions) {",
    "      const mockResponse = options2.agentMockResponse;",
    "      if (mockResponse != null) return { provider: 'mock' };",
    "      const modelExperimentState = options2.getModelExperimentState?.();",
    "      const experimentModelOverride = modelExperimentState?.model;",
    "      const requestedModel = resolveSandRequestedModel({ sessionOptions, experimentModelOverride });",
    "      const inferenceOptions = {",
    "        backend: options2.backend,",
    "        getAccessToken: options2.getAccessToken,",
    "        getGrokBotAccessToken: options2.getGrokBotToken,",
    "        getTeamId: options2.getTeamId,",
    "        getMachineId: options2.getMachineId,",
    "        requestedModel,",
    "        inferenceReason: options2.isGeminiVideoDeveloperApiEnabled?.() === true ? sessionOptions?.inferenceReason : void 0,",
    "        onRequestId,",
    "        ...sessionOptions?.lineage != null ? { lineage: sessionOptions.lineage } : {}",
    "      };",
    "      return createCursorInferencePromptSession(inferenceOptions);",
    "    }",
    "  };",
    "}",
    "async function buildMainSessionOptions(host, options2, turnRequestSource = 'main') {",
    "      const conversationId = host.getConversationId();",
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
    "          skipLabeling: false,",
    "          ...options2.lineage != null ? { lineage: options2.lineage } : {}",
    "        };",
    "      const promptPrefixObservation = { streamObserver: undefined };",
    "      const traceSendPhase = async (_ctx, _name, callback) => callback();",
    "      await traceSendPhase(",
    "            runCtx,",
    "            'inference.createSession',",
    "            async () => host.inference.createSession(emitRequestId, mainSessionOptions)",
    "          );",
    "      void promptPrefixObservation;",
    "      return mainSessionOptions;",
    "}",
    "module.exports = { createCursorSandInference, buildMainSessionOptions };",
    ""
  ].join("\n");
}

function writeFixtureManifest(file: string, source: string, anchors: Record<string, string> = ANCHORS_A5B5D79): void {
  const stock = Buffer.from(source, "utf8");
  const patched = Buffer.from(expectedPatcheda5b5d79(source), "utf8");
  fs.writeFileSync(file, JSON.stringify({
    grokBotVersion: "0.57-fixture",
    hostVersion: "a5b5d79-fixture",
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

function withFixture(run: (paths: { root: string; host: string; backup: string; manifest: string; source: string }) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "grok-codex-router-a5b5d79-"));
  const host = path.join(root, "host-main.cjs");
  const backup = path.join(root, "host-main.cjs.stock");
  const manifest = path.join(root, "manifest.json");
  const source = stocka5b5d79Fixture();
  fs.writeFileSync(host, source);
  writeFixtureManifest(manifest, source);
  try { run({ root, host, backup, manifest, source }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function runPatcher(host: string, backup: string, manifest: string, ...args: string[]) {
  return spawnSync(process.execPath, [patcher, "--host", host, "--backup", backup, "--manifest", manifest, ...args], { encoding: "utf8" });
}

test("a5b5d79 production manifest is fingerprint-bound after fresh live structural proof", () => {
  assert.equal(GROK_BOT_057_A5B5D79_MANIFEST.grokBotVersion, "0.57.0");
  assert.equal(GROK_BOT_057_A5B5D79_MANIFEST.hostVersion, "a5b5d79");
  assert.equal(GROK_BOT_057_A5B5D79_MANIFEST.anchorProof, "VERIFIED");
  assert.equal(GROK_BOT_057_A5B5D79_MANIFEST.stockHost.bytes, 26_463_140);
  assert.equal(GROK_BOT_057_A5B5D79_MANIFEST.stockHost.sha256,
    "2fd89dc7097ef9eb9f6df8b7d77823f9b4b237b96556a6ae408c33927d0045c7");
  assert.deepEqual(GROK_BOT_057_A5B5D79_MANIFEST.deterministicPatchedHost, {
    bytes: 26_463_887,
    sha256: "abdd0acc11b94fbf9f0b6004a6e0aac27eb4e2fb305b36829b6f57f72e8dfb30"
  });
  assert.deepEqual(GROK_BOT_057_A5B5D79_MANIFEST.requiredAnchorCounts, {
    inferenceOwner: 1, inferenceHook: 1, mainSessionOptions: 1, mainSessionDispatch: 1
  });
});

test("a5b5d79 exact-shape fixture checks stock, inserts one hook/identity and remains idempotent", () => {
  withFixture(({ host, backup, manifest, source }) => {
    const before = fs.readFileSync(host);
    const check = runPatcher(host, backup, manifest, "--check");
    assert.equal(check.status, 0, check.stderr);
    assert.match(check.stdout, /state=stock/);
    assert.deepEqual(fs.readFileSync(host), before);
    assert.equal(fs.existsSync(backup), false);

    assert.equal(runPatcher(host, backup, manifest).status, 0);
    const patched = fs.readFileSync(host, "utf8");
    assert.equal(patched, expectedPatcheda5b5d79(source));
    for (const marker of [SESSION_START, SESSION_END, IDENTITY_START, IDENTITY_END]) {
      assert.equal(patched.split(marker).length - 1, 1);
    }
    assert.equal(patched.split("          transcriptId: host.getTranscriptId(),").length - 1, 1);
    assert.equal(patched.split("          isGroupMemberTurn: options2.isGroupMemberTurn === true,").length - 1, 1);
    assert.equal(fs.readFileSync(backup, "utf8"), source);
    assert.equal(fs.statSync(backup).mode & 0o777, 0o600);
    const again = runPatcher(host, backup, manifest);
    assert.equal(again.status, 0, again.stderr);
    assert.match(again.stdout, /^already-installed:/);
  });
});

test("a5b5d79 exact-shape fixture fails closed on fingerprint, anchors, partial markers and backup mismatch", () => {
  withFixture(({ host, backup, manifest, source }) => {
    fs.appendFileSync(host, "x");
    assert.match(runPatcher(host, backup, manifest, "--check").stderr, /byte size/);

    fs.writeFileSync(host, source.replace("stock-model", "stock-modem"));
    assert.match(runPatcher(host, backup, manifest, "--check").stderr, /SHA-256/);

    for (const [name, anchor] of Object.entries(ANCHORS_A5B5D79)) {
      const missing = source.replace(anchor, `/* missing ${name} */`);
      fs.writeFileSync(host, missing);
      writeFixtureManifest(manifest, missing);
      const raw = JSON.parse(fs.readFileSync(manifest, "utf8"));
      raw.anchors[name] = anchor;
      fs.writeFileSync(manifest, JSON.stringify(raw));
      assert.match(runPatcher(host, backup, manifest, "--check").stderr, new RegExp(`${name} occurred 0 times`));
      const duplicated = source.replace(anchor, `${anchor}\n${anchor}`);
      fs.writeFileSync(host, duplicated);
      writeFixtureManifest(manifest, duplicated);
      const dupRaw = JSON.parse(fs.readFileSync(manifest, "utf8"));
      dupRaw.anchors[name] = anchor;
      fs.writeFileSync(manifest, JSON.stringify(dupRaw));
      assert.match(runPatcher(host, backup, manifest, "--check").stderr, new RegExp(`${name} occurred 2 times`));
    }

    fs.writeFileSync(host, source);
    writeFixtureManifest(manifest, source);
    assert.equal(runPatcher(host, backup, manifest).status, 0);
    fs.writeFileSync(host, fs.readFileSync(host, "utf8").replace(SESSION_END, ""));
    assert.match(runPatcher(host, backup, manifest, "--check").stderr, /partial or duplicated/);

    fs.writeFileSync(host, source);
    fs.writeFileSync(backup, source.replace("stock-model", "stock-modem"));
    fs.chmodSync(backup, 0o600);
    assert.match(runPatcher(host, backup, manifest, "--check").stderr, /stock backup SHA-256/);
  });
});

test("a5b5d79 patched fallback routes only the approved pilot and preserves all stock passthroughs", () => {
  withFixture(({ root, host, backup, manifest }) => {
    const routerHome = path.join(root, "router");
    const dataRoot = path.join(root, "sand-data");
    fs.mkdirSync(routerHome);
    fs.mkdirSync(path.join(dataRoot, "agents", M1_PILOT_AGENT_ID), { recursive: true });
    fs.mkdirSync(path.join(dataRoot, "agents", "other-box"), { recursive: true });
    fs.writeFileSync(path.join(dataRoot, "agents", M1_PILOT_AGENT_ID, "profile.json"), JSON.stringify({ harness: "box" }));
    fs.writeFileSync(path.join(dataRoot, "agents", "other-box", "profile.json"), JSON.stringify({ harness: "box" }));
    fs.writeFileSync(path.join(routerHome, "index.js"), [
      "const fs=require('fs'),path=require('path');",
      `const pilot=${JSON.stringify(M1_PILOT_AGENT_ID)};`,
      "module.exports.shouldUseCodexRouter = options => {",
      "  const required=['isComputerUseSubagent','isBrowserUseSubagent','isSubagent','isGroupMemberTurn'];",
      "  const summarization=options?.isSummarizationSession;",
      "  if (options?.conversationId !== pilot || (summarization !== undefined && typeof summarization !== 'boolean') || summarization === true || required.some(k => typeof options?.[k] !== 'boolean' || options[k])) return false;",
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
      `const base={conversationId:${JSON.stringify(M1_PILOT_AGENT_ID)},transcriptId:'t',isComputerUseSubagent:false,isBrowserUseSubagent:false,isSubagent:false,isGroupMemberTurn:false,requestSource:'main'};`,
      "const routed=inf.createSession(()=>{},base);",
      "const other=inf.createSession(()=>{},{...base,conversationId:'other-box'});",
      "const workloads=['isSummarizationSession','isComputerUseSubagent','isBrowserUseSubagent','isSubagent','isGroupMemberTurn'].map(k=>inf.createSession(()=>{},{...base,[k]:true}).provider);",
      "const automation=inf.createSession(()=>{},{...base,requestSource:'scheduled-automation'}).provider;",
      `require('fs').writeFileSync(require('path').join(process.env.SAND_DATA_ROOT,'agents',${JSON.stringify(M1_PILOT_AGENT_ID)},'profile.json'),JSON.stringify({harness:'temporal'}));`,
      "const temporal=inf.createSession(()=>{},base).provider;",
      `const hostObj={subagentType:'main',subagentModelId:'model',isSubagentRunner:false,isComputerUseSubagent:false,isBrowserUseSubagent:false,getConversationId:()=>${JSON.stringify(M1_PILOT_AGENT_ID)},getTranscriptId:()=> 'transcript-main',inference:{createSession:()=>({})}};`,
      "h.buildMainSessionOptions(hostObj,{isGroupMemberTurn:false}).then(options=>console.log(JSON.stringify({routed:routed.provider,other:other.provider,workloads,automation,temporal,options})));"
    ].join("\n")], { encoding: "utf8", env: { ...process.env, SAND_CODEX_ROUTER_HOME: routerHome, SAND_DATA_ROOT: dataRoot } });
    assert.equal(exercise.status, 0, exercise.stderr);
    const result = JSON.parse(exercise.stdout);
    assert.equal(result.routed, "router");
    assert.equal(result.other, "stock");
    assert.deepEqual(result.workloads, ["stock", "stock", "stock", "stock", "stock"]);
    assert.equal(result.automation, "stock");
    assert.equal(result.temporal, "stock");
    assert.equal(result.options.conversationId, M1_PILOT_AGENT_ID);
    assert.equal(result.options.transcriptId, "transcript-main");
    assert.equal(result.options.isGroupMemberTurn, false);
  });
});
