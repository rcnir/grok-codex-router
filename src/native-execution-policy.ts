import { RuntimeFault } from "./runtime-client.js";
import type { JsonObject } from "./sand-values.js";

export const NATIVE_POLICY_RESEARCH = Object.freeze({
  codexVersion: "0.154.0",
  sourceCommit: "6b9826e3aa83b1a5947db50f4332cb9c65f1b340",
  status: "UNVERIFIED" as const,
  verifiedSubset: ["empty environments removes shell, apply_patch, view_image and request_permissions"],
  unresolved: ["no source-proven per-thread inherited-MCP deny-all; managed requirements are separate",
    "host/managed browser-computer exclusion", "complete configured execution profile is not installed"]
});

/** Fixture seam, not a configuration flag or a production bypass. */
export interface ThreadPolicyVerifier {
  verify(status: JsonObject): void;
}

/** No amount of config/allowlisting can turn an unproved policy into authority. */
export const productionThreadPolicy: ThreadPolicyVerifier = Object.freeze({
  verify(_status: JsonObject): never {
    throw new RuntimeFault("NATIVE_TOOL_CONTRACT_UNVERIFIED");
  }
});
