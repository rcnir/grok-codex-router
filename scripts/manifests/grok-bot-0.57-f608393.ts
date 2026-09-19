import type { GrokBotHostCompatibilityManifest } from "./types.js";

export const GROK_BOT_057_F608393_MANIFEST = Object.freeze<GrokBotHostCompatibilityManifest>({
  grokBotVersion: "0.57.0",
  hostVersion: "f608393",
  hostPath: "/home/box/sand-host/host-main.cjs",
  anchorProof: "VERIFIED",
  routerMarkerVersion: 1,
  stockHost: {
    bytes: 26_468_193,
    sha256: "da5b2494c41198e593c626c5d5d617d8ddf5eb75fed62effea63d8388a8e6032"
  },
  deterministicPatchedHost: {
    bytes: 26_468_940,
    sha256: "614b74aeef87b8870e4f964d9dbea43e59182a54baf910ef7bba35bf1c6f7469"
  },
  pristineBackup: {
    sha256: "da5b2494c41198e593c626c5d5d617d8ddf5eb75fed62effea63d8388a8e6032",
    mode: 0o600
  },
  anchors: {
    inferenceOwner: "function createCursorSandInference(options2) {",
    inferenceHook: "      return createCursorInferencePromptSession(inferenceOptions);",
    mainSessionOptions: [
      "        const mainSessionOptions = {",
      "          ...executorProfile === void 0 ? { modelId: host.subagentModelId } : { executorProfile },"
    ].join("\n"),
    mainSessionDispatch: "            async () => host.inference.createSession(emitRequestId, mainSessionOptions)"
  },
  requiredAnchorCounts: {
    inferenceOwner: 1,
    inferenceHook: 1,
    mainSessionOptions: 1,
    mainSessionDispatch: 1
  }
});
