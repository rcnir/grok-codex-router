import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { GROK_BOT_053_11DD264_MANIFEST } from "../scripts/manifests/grok-bot-0.53-11dd264.js";

const patcher = path.resolve(__dirname, "..", "scripts", "patch-host.js");

const FIXTURE_ANCHORS = {
  servicePrelude: [
    "const __mod=require('node:module');",
    '"use strict";'
  ].join("\n"),
  inferenceOwner: "function createCursorSandInference(options2) {",
  nativeSession: "      const session = createCursorInferencePromptSession({",
  mainSessionOptions: [
    "        const mainSessionOptions = {",
    "          modelId: host.subagentModelId,"
  ].join("\n")
};

function stockHostFixture(): string {
  return [
    "const __mod=require('node:module');",
    '"use strict";',
    "function resolveSandRequestedModel() { return 'native-model'; }",
    "function createCursorInferencePromptSession(options) {",
    "  return { provider: 'native', options };",
    "}",
    "function createCursorSandInference(options2) {",
    "  return {",
    "    createSession(onRequestId, sessionOptions) {",
    "      const storedBrowserUseModel = sessionOptions?.storedBrowserUseModel;",
    "      void storedBrowserUseModel;",
    "      const requestedModel = resolveSandRequestedModel({ sessionOptions });",
    "      const session = createCursorInferencePromptSession({",
    "        getAccessToken: options2.getAccessToken,",
    "        getMachineId: options2.getMachineId,",
    "        requestedModel,",
    "        onRequestId",
    "      });",
    "      return session;",
    "    }",
    "  };",
    "}",
    "function buildMainSessionOptions(host, options2, conversationId) {",
    "        const mainSessionOptions = {",
    "          modelId: host.subagentModelId,",
    "          inferenceReason: host.inferenceReason,",
    "        };",
    "  return mainSessionOptions;",
    "}",
    "module.exports = { createCursorSandInference, buildMainSessionOptions };",
    ""
  ].join("\n");
}

function sha256(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function writeFixtureManifest(file: string, source: string, anchors = FIXTURE_ANCHORS): void {
  const bytes = Buffer.from(source, "utf8");
  fs.writeFileSync(file, JSON.stringify({
    grokBotVersion: "fixture",
    hostVersion: "fixture-host",
    hostPath: "/fixture/host-main.cjs",
    anchorProof: "VERIFIED",
    routerMarkerVersion: 1,
    stockHost: { bytes: bytes.length, sha256: sha256(bytes) },
    pristineBackup: { sha256: sha256(bytes), mode: 0o600 },
    anchors,
    requiredAnchorCounts: Object.fromEntries(Object.keys(anchors).map((name) => [name, 1]))
  }));
}

function runPatcher(
  host: string,
  backup: string,
  manifest: string,
  ...args: string[]
) {
  return spawnSync(process.execPath, [
    patcher,
    "--host", host,
    "--backup", backup,
    "--manifest", manifest,
    ...args
  ], { encoding: "utf8" });
}

function withFixture(run: (paths: { root: string; host: string; backup: string; manifest: string; source: string }) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "grok-codex-router-host-"));
  const host = path.join(root, "host-main.cjs");
  const backup = path.join(root, "backup", "host-main.cjs.stock");
  const manifest = path.join(root, "manifest.json");
  const source = stockHostFixture();
  fs.writeFileSync(host, source);
  writeFixtureManifest(manifest, source);
  try {
    run({ root, host, backup, manifest, source });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("production manifest is bound to reviewed Grok Bot 0.53 host 11dd264", () => {
  assert.equal(GROK_BOT_053_11DD264_MANIFEST.grokBotVersion, "0.53");
  assert.equal(GROK_BOT_053_11DD264_MANIFEST.hostVersion, "11dd264");
  assert.equal(GROK_BOT_053_11DD264_MANIFEST.anchorProof, "BLOCKED");
  assert.equal(GROK_BOT_053_11DD264_MANIFEST.stockHost.bytes, 26_361_676);
  assert.equal(
    GROK_BOT_053_11DD264_MANIFEST.stockHost.sha256,
    "bb7012d56e474375a879311eff1d91fbd389e098023f2856c376b963c5df3d83"
  );
});

test("blocked anchor proof permits fingerprint inspection only and refuses every mutation before writes", () => {
  withFixture(({ host, backup, manifest, source }) => {
    const raw = JSON.parse(fs.readFileSync(manifest, "utf8"));
    raw.anchorProof = "BLOCKED";
    fs.writeFileSync(manifest, JSON.stringify(raw));

    const check = runPatcher(host, backup, manifest, "--check");
    assert.equal(check.status, 2, check.stderr);
    assert.match(check.stdout, /anchorProof=BLOCKED compatible=false/);
    assert.equal(fs.readFileSync(host, "utf8"), source);
    assert.equal(fs.existsSync(backup), false);

    const install = runPatcher(host, backup, manifest);
    assert.equal(install.status, 1);
    assert.match(install.stderr, /ANCHOR_PROOF_BLOCKED/);
    assert.equal(fs.readFileSync(host, "utf8"), source);
    assert.equal(fs.existsSync(backup), false);

    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.writeFileSync(backup, source);
    const backupBefore = fs.readFileSync(backup);
    const restore = runPatcher(host, backup, manifest, "--restore");
    assert.equal(restore.status, 1);
    assert.match(restore.stderr, /ANCHOR_PROOF_BLOCKED/);
    assert.equal(fs.readFileSync(host, "utf8"), source);
    assert.deepEqual(fs.readFileSync(backup), backupBefore);
  });
});

test("custom fixture manifest cannot override production host pin or anchor proof", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "grok-codex-router-manifest-guard-"));
  const manifest = path.join(root, "manifest.json");
  const backup = path.join(root, "backup.stock");
  const source = stockHostFixture();
  writeFixtureManifest(manifest, source);
  try {
    const result = runPatcher(
      GROK_BOT_053_11DD264_MANIFEST.hostPath,
      backup,
      manifest,
      "--check"
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /CUSTOM_MANIFEST_FORBIDDEN_ON_PRODUCTION_HOST/);
    assert.equal(fs.existsSync(backup), false);

    const alias = path.join(root, "production-host-alias.cjs");
    fs.symlinkSync(GROK_BOT_053_11DD264_MANIFEST.hostPath, alias);
    const aliasResult = runPatcher(alias, backup, manifest, "--check");
    assert.equal(aliasResult.status, 1);
    assert.match(aliasResult.stderr, /CUSTOM_MANIFEST_FORBIDDEN_ON_PRODUCTION_HOST/);
    assert.equal(fs.existsSync(backup), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("check is read-only and exact stock installs once with pristine backup and exact restore", () => {
  withFixture(({ host, backup, manifest, source }) => {
    const before = fs.readFileSync(host);
    const check = runPatcher(host, backup, manifest, "--check");
    assert.equal(check.status, 0, check.stderr);
    assert.match(check.stdout, /state=stock/);
    assert.deepEqual(fs.readFileSync(host), before);
    assert.equal(fs.existsSync(backup), false);

    const install = runPatcher(host, backup, manifest);
    assert.equal(install.status, 0, install.stderr);
    assert.match(install.stdout, /^installed:/);
    assert.equal(fs.readFileSync(backup, "utf8"), source);
    assert.equal(fs.statSync(backup).mode & 0o777, 0o600);

    const patched = fs.readFileSync(host, "utf8");
    assert.equal(patched.split("GROK_CODEX_ROUTER_SESSION_START").length - 1, 1);
    assert.equal(patched.split("GROK_CODEX_ROUTER_SESSION_END").length - 1, 1);
    assert.equal(patched.split("GROK_CODEX_ROUTER_IDENTITY_START").length - 1, 1);
    assert.equal(patched.split("GROK_CODEX_ROUTER_IDENTITY_END").length - 1, 1);
    assert.equal(patched.split("GROK_CODEX_ROUTER_SERVICE_START").length - 1, 0);
    assert.equal(patched.split("GROK_CODEX_ROUTER_SERVICE_END").length - 1, 0);
    assert.equal(patched.includes("ensureControlService"), false);
    assert.equal(patched.split("          conversationId,").length - 1, 1);
    assert.equal(patched.split("          transcriptId: host.getTranscriptId(),").length - 1, 1);
    assert.equal(patched.split("          isGroupMemberTurn: options2.isGroupMemberTurn === true,").length - 1, 1);

    const checkPatched = runPatcher(host, backup, manifest, "--check");
    assert.equal(checkPatched.status, 0, checkPatched.stderr);
    assert.match(checkPatched.stdout, /state=patched/);

    const installAgain = runPatcher(host, backup, manifest);
    assert.equal(installAgain.status, 0, installAgain.stderr);
    assert.match(installAgain.stdout, /^already-installed:/);
    assert.equal(fs.readFileSync(host, "utf8"), patched);
    const checkAgain = runPatcher(host, backup, manifest, "--check");
    assert.equal(checkAgain.status, 0, checkAgain.stderr);
    assert.match(checkAgain.stdout, /state=patched/);

    const restore = runPatcher(host, backup, manifest, "--restore");
    assert.equal(restore.status, 0, restore.stderr);
    assert.match(restore.stdout, /^restored:/);
    assert.equal(fs.readFileSync(host, "utf8"), source);
    assert.equal(fs.readFileSync(backup, "utf8"), source);
  });
});

test("patched seam preserves stock inference when the router policy says no", () => {
  withFixture(({ root, host, backup, manifest }) => {
    const routerHome = path.join(root, "router");
    fs.mkdirSync(routerHome);
    fs.writeFileSync(path.join(routerHome, "index.js"), [
      "module.exports.shouldUseCodexRouter = options => options?.conversationId === 'allowlisted-agent';",
      "module.exports.createCodexRouterSession = options => ({ provider: 'router', options });",
      ""
    ].join("\n"));

    const install = runPatcher(host, backup, manifest);
    assert.equal(install.status, 0, install.stderr);
    const exercise = spawnSync(process.execPath, ["-e", [
      `const host = require(${JSON.stringify(host)});`,
      "const inference = host.createCursorSandInference({ getAccessToken() {}, getMachineId() {} });",
      "const stock = inference.createSession(() => {}, { conversationId: 'other-agent', transcriptId: 't-stock' });",
      "const routed = inference.createSession(() => {}, { conversationId: 'allowlisted-agent', transcriptId: 't-route' });",
      "const options = host.buildMainSessionOptions({ subagentModelId: 'model', inferenceReason: 'main', getTranscriptId: () => 'transcript-main' }, { isGroupMemberTurn: false }, 'agent-main');",
      "console.log(JSON.stringify({ stock: stock.provider, routed: routed.provider, options }));"
    ].join("\n")], {
      encoding: "utf8",
      env: { ...process.env, SAND_CODEX_ROUTER_HOME: routerHome }
    });
    assert.equal(exercise.status, 0, exercise.stderr);
    assert.deepEqual(JSON.parse(exercise.stdout), {
      stock: "native",
      routed: "router",
      options: {
        conversationId: "agent-main",
        transcriptId: "transcript-main",
        isGroupMemberTurn: false,
        modelId: "model",
        inferenceReason: "main"
      }
    });
  });
});

test("unknown byte size and unknown SHA fail before mutation", () => {
  withFixture(({ host, backup, manifest, source }) => {
    fs.appendFileSync(host, "x");
    const wrongSize = fs.readFileSync(host);
    const sizeResult = runPatcher(host, backup, manifest);
    assert.equal(sizeResult.status, 1);
    assert.match(sizeResult.stderr, /byte size/);
    assert.deepEqual(fs.readFileSync(host), wrongSize);
    assert.equal(fs.existsSync(backup), false);

    fs.writeFileSync(host, source.replace("native-model", "native-modem"));
    assert.equal(fs.statSync(host).size, Buffer.byteLength(source));
    const wrongSha = fs.readFileSync(host);
    const shaResult = runPatcher(host, backup, manifest);
    assert.equal(shaResult.status, 1);
    assert.match(shaResult.stderr, /SHA-256/);
    assert.deepEqual(fs.readFileSync(host), wrongSha);
    assert.equal(fs.existsSync(backup), false);
  });
});

test("fingerprint-matching source still requires every unique structural anchor", () => {
  withFixture(({ host, backup, manifest, source }) => {
    const missing = source.replace(FIXTURE_ANCHORS.nativeSession, "      const session = nativePromptSession({");
    fs.writeFileSync(host, missing);
    writeFixtureManifest(manifest, missing);
    const missingBefore = fs.readFileSync(host);
    const missingResult = runPatcher(host, backup, manifest);
    assert.equal(missingResult.status, 1);
    assert.match(missingResult.stderr, /nativeSession occurred 0 times/);
    assert.deepEqual(fs.readFileSync(host), missingBefore);
    assert.equal(fs.existsSync(backup), false);

    const duplicated = source.replace(
      FIXTURE_ANCHORS.nativeSession,
      `${FIXTURE_ANCHORS.nativeSession}\n${FIXTURE_ANCHORS.nativeSession}`
    );
    fs.writeFileSync(host, duplicated);
    writeFixtureManifest(manifest, duplicated);
    const before = fs.readFileSync(host);
    const result = runPatcher(host, backup, manifest);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /nativeSession occurred 2 times/);
    assert.deepEqual(fs.readFileSync(host), before);
    assert.equal(fs.existsSync(backup), false);
  });
});

test("partial router markers fail closed without rewriting the host", () => {
  withFixture(({ host, backup, manifest }) => {
    const install = runPatcher(host, backup, manifest);
    assert.equal(install.status, 0, install.stderr);
    const partial = fs.readFileSync(host, "utf8").replace("/* GROK_CODEX_ROUTER_SESSION_END */", "");
    fs.writeFileSync(host, partial);

    const check = runPatcher(host, backup, manifest, "--check");
    assert.equal(check.status, 1);
    assert.match(check.stderr, /partial or duplicated/);
    assert.equal(fs.readFileSync(host, "utf8"), partial);
  });
});

test("complete markers do not authenticate a tampered patched host", () => {
  withFixture(({ host, backup, manifest }) => {
    const install = runPatcher(host, backup, manifest);
    assert.equal(install.status, 0, install.stderr);
    const tampered = fs.readFileSync(host, "utf8").replace("requestedModel,", "requestedModel: 'tampered',");
    fs.writeFileSync(host, tampered);

    const check = runPatcher(host, backup, manifest, "--check");
    assert.equal(check.status, 1);
    assert.match(check.stderr, /does not exactly match the deterministic image/);
    assert.equal(fs.readFileSync(host, "utf8"), tampered);

    const restore = runPatcher(host, backup, manifest, "--restore");
    assert.equal(restore.status, 1);
    assert.match(restore.stderr, /does not match the deterministic patched image/);
    assert.equal(fs.readFileSync(host, "utf8"), tampered);
  });
});

test("an existing backup must itself be the reviewed pristine stock image", () => {
  withFixture(({ host, backup, manifest, source }) => {
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.writeFileSync(backup, source.replace("native-model", "native-modem"));
    fs.chmodSync(backup, 0o600);
    const backupBefore = fs.readFileSync(backup);
    const check = runPatcher(host, backup, manifest, "--check");
    assert.equal(check.status, 1);
    assert.match(check.stderr, /stock backup SHA-256/);
    assert.deepEqual(fs.readFileSync(backup), backupBefore);
    const install = runPatcher(host, backup, manifest);
    assert.equal(install.status, 1);
    assert.match(install.stderr, /stock backup SHA-256/);
    assert.equal(fs.readFileSync(host, "utf8"), source);
    assert.deepEqual(fs.readFileSync(backup), backupBefore);
  });
});

test("backup creation failure leaves the stock host unchanged", () => {
  withFixture(({ root, host, manifest, source }) => {
    const blockedParent = path.join(root, "backup-parent-is-a-file");
    fs.writeFileSync(blockedParent, "not a directory");
    const impossibleBackup = path.join(blockedParent, "host-main.cjs.stock");
    const before = fs.readFileSync(host);

    const result = runPatcher(host, impossibleBackup, manifest);
    assert.equal(result.status, 1);
    assert.deepEqual(fs.readFileSync(host), before);
    assert.equal(fs.readFileSync(host, "utf8"), source);
    assert.equal(fs.existsSync(impossibleBackup), false);
  });
});
