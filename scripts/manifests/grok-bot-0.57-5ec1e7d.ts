import type { GrokBotHostCompatibilityManifest } from "./types.js";

/**
 * Grok Bot 0.57 / host 5ec1e7d compatibility contract.
 *
 * The stock fingerprint was freshly measured from the assigned production host
 * after Sand's automatic upgrade on 2026-09-19. Source/local acceptance and a
 * fresh actual-host structural proof both passed before `anchorProof` was
 * promoted for this exact fingerprint.
 */
export const GROK_BOT_057_5EC1E7D_MANIFEST = Object.freeze<GrokBotHostCompatibilityManifest>({
  grokBotVersion: "0.57.0",
  hostVersion: "5ec1e7d",
  hostPath: "/home/box/sand-host/host-main.cjs",
  anchorProof: "VERIFIED",
  routerMarkerVersion: 1,
  stockHost: {
    bytes: 26_460_874,
    sha256: "8b0e2747c0b7b91fca368c886880b24906a28214e2979029a60a98d8ab0c9bc0"
  },
  deterministicPatchedHost: {
    bytes: 26_461_621,
    sha256: "58493df0bc8fa4b22d981a23835468fa4908a3f73c1819b27375eaaab13e018f"
  },
  pristineBackup: {
    sha256: "8b0e2747c0b7b91fca368c886880b24906a28214e2979029a60a98d8ab0c9bc0",
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
