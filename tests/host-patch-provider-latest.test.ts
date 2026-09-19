import assert from "node:assert/strict";
import test from "node:test";
import { GROK_BOT_057_720BAF1_MANIFEST } from "../scripts/manifests/grok-bot-0.57-720baf1.js";
import { GROK_BOT_057_F608393_MANIFEST } from "../scripts/manifests/grok-bot-0.57-f608393.js";

const expectedAnchors = {
  inferenceOwner: "function createCursorSandInference(options2) {",
  inferenceHook: "      return createCursorInferencePromptSession(inferenceOptions);",
  mainSessionOptions: [
    "        const mainSessionOptions = {",
    "          ...executorProfile === void 0 ? { modelId: host.subagentModelId } : { executorProfile },"
  ].join("\n"),
  mainSessionDispatch: "            async () => host.inference.createSession(emitRequestId, mainSessionOptions)"
};

for (const [name, manifest, expected] of [
  ["720baf1", GROK_BOT_057_720BAF1_MANIFEST, {
    stockBytes: 26_468_498,
    stockSha: "148b28dab774cbc5befd0fbef8477c1a2bf3884e6115497a4ff6d696302f289a",
    patchedBytes: 26_469_245,
    patchedSha: "f0581785f0c33e12cd76cb96c127b9e140225f99a0fa592da5dae14c796b9837"
  }],
  ["f608393", GROK_BOT_057_F608393_MANIFEST, {
    stockBytes: 26_468_193,
    stockSha: "da5b2494c41198e593c626c5d5d617d8ddf5eb75fed62effea63d8388a8e6032",
    patchedBytes: 26_468_940,
    patchedSha: "614b74aeef87b8870e4f964d9dbea43e59182a54baf910ef7bba35bf1c6f7469"
  }]
] as const) {
  test(`${name} provider-latest manifest is exact and fingerprint-bound`, () => {
    assert.equal(manifest.grokBotVersion, "0.57.0");
    assert.equal(manifest.hostVersion, name);
    assert.equal(manifest.anchorProof, "VERIFIED");
    assert.deepEqual(manifest.stockHost, {
      bytes: expected.stockBytes,
      sha256: expected.stockSha
    });
    assert.deepEqual(manifest.deterministicPatchedHost, {
      bytes: expected.patchedBytes,
      sha256: expected.patchedSha
    });
    assert.deepEqual(manifest.pristineBackup, {
      sha256: expected.stockSha,
      mode: 0o600
    });
    assert.deepEqual(manifest.anchors, expectedAnchors);
    assert.deepEqual(manifest.requiredAnchorCounts, {
      inferenceOwner: 1,
      inferenceHook: 1,
      mainSessionOptions: 1,
      mainSessionDispatch: 1
    });
  });
}
