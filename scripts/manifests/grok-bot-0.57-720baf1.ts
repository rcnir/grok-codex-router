import type { GrokBotHostCompatibilityManifest } from "./types.js";

export const GROK_BOT_057_720BAF1_MANIFEST = Object.freeze<GrokBotHostCompatibilityManifest>({
  grokBotVersion: "0.57.0",
  hostVersion: "720baf1",
  hostPath: "/home/box/sand-host/host-main.cjs",
  anchorProof: "VERIFIED",
  routerMarkerVersion: 1,
  stockHost: {
    bytes: 26_468_498,
    sha256: "148b28dab774cbc5befd0fbef8477c1a2bf3884e6115497a4ff6d696302f289a"
  },
  deterministicPatchedHost: {
    bytes: 26_469_245,
    sha256: "f0581785f0c33e12cd76cb96c127b9e140225f99a0fa592da5dae14c796b9837"
  },
  pristineBackup: {
    sha256: "148b28dab774cbc5befd0fbef8477c1a2bf3884e6115497a4ff6d696302f289a",
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
