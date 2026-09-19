import type { GrokBotHostCompatibilityManifest } from "./types.js";

/**
 * Grok Bot 0.57 / host 18cd065 compatibility contract.
 *
 * The stock fingerprint and structural anchors below were measured from the
 * assigned production host on 2026-09-19. The source/local port and a fresh
 * actual-host structural check both passed before `anchorProof` was promoted.
 */
export const GROK_BOT_057_18CD065_MANIFEST = Object.freeze<GrokBotHostCompatibilityManifest>({
  grokBotVersion: "0.57.0",
  hostVersion: "18cd065",
  hostPath: "/home/box/sand-host/host-main.cjs",
  anchorProof: "VERIFIED",
  routerMarkerVersion: 1,
  stockHost: {
    bytes: 26_438_264,
    sha256: "c667b530962bbf94a2ba77659b0440f20dd553dfdbabdd4a2cd157e4335bba29"
  },
  deterministicPatchedHost: {
    bytes: 26_439_011,
    sha256: "07835cd847c027aa2628741c2fb93a7c2ebbcb67a55c4861254dfc51af522b1d"
  },
  pristineBackup: {
    sha256: "c667b530962bbf94a2ba77659b0440f20dd553dfdbabdd4a2cd157e4335bba29",
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
