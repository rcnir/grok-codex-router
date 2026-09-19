import { RuntimeFault } from "./runtime-client.js";
import { isRecord, type JsonObject } from "./sand-values.js";

export const NATIVE_POLICY_RESEARCH = Object.freeze({
    codexVersion: "0.154.0",
    status: "RUNTIME_SCHEMA_GATED" as const,
    authority: "runtime_status.capabilities.dynamic_only_tool_policy" as const
});

export type ToolIsolationPolicy = "default" | "dynamicOnly";

/** Authority comes only from the Runtime's executable-verified protocol capability. */
export const productionThreadPolicy = Object.freeze({
  verify(status: JsonObject, requested: ToolIsolationPolicy): void {
    const capabilities = status.capabilities;
    if (requested !== "dynamicOnly" || !isRecord(capabilities) ||
        capabilities.dynamic_only_tool_policy !== true) {
      throw new RuntimeFault("NATIVE_TOOL_CONTRACT_UNVERIFIED");
    }
  }
});
