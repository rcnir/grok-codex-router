export interface GrokBotHostCompatibilityManifest {
  grokBotVersion: string;
  hostVersion: string;
  hostPath: string;
  anchorProof: "VERIFIED" | "BLOCKED";
  stockHost: {
    bytes: number;
    sha256: string;
  };
  anchors: {
    servicePrelude: string;
    inferenceOwner: string;
    nativeSession: string;
    mainSessionOptions: string;
  };
}

export const GROK_BOT_053_11DD264_MANIFEST = Object.freeze<GrokBotHostCompatibilityManifest>({
  grokBotVersion: "0.53",
  hostVersion: "11dd264",
  hostPath: "/home/box/sand-host/host-main.cjs",
  // The exact stock fingerprint was supplied by the user, but the bounded
  // read-only 0.53 host-source retrieval was unavailable in Milestone 1.
  // Candidate anchors below come from retained local prior-version evidence
  // and MUST NOT authorize a production mutation until re-verified on 0.53.
  anchorProof: "BLOCKED",
  stockHost: {
    bytes: 26_361_676,
    sha256: "bb7012d56e474375a879311eff1d91fbd389e098023f2856c376b963c5df3d83"
  },
  anchors: {
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
  }
});
