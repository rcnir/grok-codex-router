export interface HostFingerprint {
  bytes: number;
  sha256: string;
}

export interface GrokBotHostCompatibilityManifest {
  grokBotVersion: string;
  hostVersion: string;
  hostPath: string;
  anchorProof: "VERIFIED" | "BLOCKED";
  routerMarkerVersion: 1;
  stockHost: HostFingerprint;
  deterministicPatchedHost?: HostFingerprint | undefined;
  pristineBackup?: {
    sha256: string;
    mode: number;
  } | undefined;
  anchors: {
    servicePrelude?: string | undefined;
    inferenceOwner: string;
    /** Legacy <=0.53 insertion seam. */
    nativeSession?: string | undefined;
    /** Current insertion seam immediately before the stock inference fallback. */
    inferenceHook?: string | undefined;
    mainSessionOptions: string;
    mainSessionDispatch?: string | undefined;
  };
  requiredAnchorCounts?: Record<string, number> | undefined;
}
