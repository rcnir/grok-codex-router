import type { GrokBotHostCompatibilityManifest } from "./types.js";

/**
 * Grok Bot 0.57 / host 251860d compatibility contract.
 *
 * The stock fingerprint was freshly measured from the assigned production host
 * after Sand's automatic upgrade on 2026-09-19. Source/local acceptance and a
 * fresh actual-host structural proof both passed before `anchorProof` was
 * promoted for this exact fingerprint.
 */
export const GROK_BOT_057_251860D_MANIFEST = Object.freeze<GrokBotHostCompatibilityManifest>({
  grokBotVersion: "0.57.0",
  hostVersion: "251860d",
  hostPath: "/home/box/sand-host/host-main.cjs",
  anchorProof: "VERIFIED",
  routerMarkerVersion: 1,
  stockHost: {
    bytes: 26_453_384,
    sha256: "2354d46da4304d11110645f4e7fa565a15de1b30cd1d80971db2b8934a278161"
  },
  deterministicPatchedHost: {
    bytes: 26_454_131,
    sha256: "8d8c2c239667e38f421d6b96af994c279b69fdbaddbb91bed927f16a02aef5ea"
  },
  pristineBackup: {
    sha256: "2354d46da4304d11110645f4e7fa565a15de1b30cd1d80971db2b8934a278161",
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
