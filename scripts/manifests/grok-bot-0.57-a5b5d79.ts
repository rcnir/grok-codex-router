import type { GrokBotHostCompatibilityManifest } from "./types.js";

/**
 * Grok Bot 0.57 / host a5b5d79 compatibility contract.
 *
 * The stock fingerprint was freshly measured from the assigned production host
 * on 2026-09-19. Source/local acceptance and a fresh actual-host structural proof
 * both passed before `anchorProof` was promoted for this exact fingerprint.
 */
export const GROK_BOT_057_A5B5D79_MANIFEST = Object.freeze<GrokBotHostCompatibilityManifest>({
  grokBotVersion: "0.57.0",
  hostVersion: "a5b5d79",
  hostPath: "/home/box/sand-host/host-main.cjs",
  anchorProof: "VERIFIED",
  routerMarkerVersion: 1,
  stockHost: {
    bytes: 26_463_140,
    sha256: "2fd89dc7097ef9eb9f6df8b7d77823f9b4b237b96556a6ae408c33927d0045c7"
  },
  deterministicPatchedHost: {
    bytes: 26_463_887,
    sha256: "abdd0acc11b94fbf9f0b6004a6e0aac27eb4e2fb305b36829b6f57f72e8dfb30"
  },
  pristineBackup: {
    sha256: "2fd89dc7097ef9eb9f6df8b7d77823f9b4b237b96556a6ae408c33927d0045c7",
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
