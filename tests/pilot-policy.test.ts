import assert from "node:assert/strict";
import test from "node:test";
import { M1_PILOT_AGENT_ID } from "../src/config.js";
import { shouldUseCodexRouter, type CodexRouterPilotPolicyInput } from "../src/pilot-policy.js";

const RETIRED_TEMPORAL_PILOT_ID = "97cf83a0-0401-4481-9f3f-8b321921f8b0";

function eligible(overrides: Partial<CodexRouterPilotPolicyInput> = {}): CodexRouterPilotPolicyInput {
  return {
    enabled: true,
    allowlistedAgentIds: new Set([M1_PILOT_AGENT_ID]),
    executionHarness: "box",
    sessionOptions: {
      conversationId: M1_PILOT_AGENT_ID,
      transcriptId: "transcript-a",
      isSummarizationSession: false,
      isComputerUseSubagent: false,
      isBrowserUseSubagent: false,
      isSubagent: false,
      isGroupMemberTurn: false,
      requestSource: "main"
    },
    ...overrides
  };
}

test("pilot routing requires enabled, allowlisted lowercase box root identity", () => {
  assert.equal(shouldUseCodexRouter(eligible()), true);
  assert.equal(shouldUseCodexRouter(eligible({ enabled: false })), false);
  assert.equal(shouldUseCodexRouter(eligible({ executionHarness: "temporal" })), false);
  assert.equal(shouldUseCodexRouter(eligible({ executionHarness: "BOX" })), false);
  assert.equal(shouldUseCodexRouter(eligible({
    sessionOptions: { ...eligible().sessionOptions, conversationId: "agent-b", transcriptId: "transcript-b" }
  })), false);
  assert.equal(shouldUseCodexRouter(eligible({
    sessionOptions: { ...eligible().sessionOptions, transcriptId: undefined }
  })), false);
  assert.equal(shouldUseCodexRouter(eligible({
    sessionOptions: { ...eligible().sessionOptions, conversationId: undefined }
  })), false);
  assert.equal(shouldUseCodexRouter(eligible({
    sessionOptions: { ...eligible().sessionOptions, conversationId: "   " }
  })), false);
  assert.equal(shouldUseCodexRouter(eligible({
    sessionOptions: { ...eligible().sessionOptions, conversationId: ` ${M1_PILOT_AGENT_ID} ` }
  })), false);
  assert.equal(shouldUseCodexRouter(eligible({
    sessionOptions: { ...eligible().sessionOptions, conversationId: RETIRED_TEMPORAL_PILOT_ID }
  })), false);
});

test("all non-root workload classes stay on stock inference", () => {
  const denied = [
    { isSummarizationSession: true },
    { isSubagent: true },
    { isBrowserUseSubagent: true },
    { isComputerUseSubagent: true },
    { isGroupMemberTurn: true },
    { requestSource: "scheduled-automation" }
  ];
  for (const extra of denied) {
    assert.equal(shouldUseCodexRouter(eligible({
      sessionOptions: {
        ...eligible().sessionOptions,
        ...extra
      }
    })), false, JSON.stringify(extra));
  }
});

test("missing or non-boolean root classifiers and unknown request source fail closed", () => {
  const flags = [
    "isSummarizationSession",
    "isComputerUseSubagent",
    "isBrowserUseSubagent",
    "isSubagent",
    "isGroupMemberTurn"
  ] as const;
  for (const flag of flags) {
    const missing = { ...eligible().sessionOptions };
    delete missing[flag];
    assert.equal(shouldUseCodexRouter(eligible({ sessionOptions: missing })), false, `missing ${flag}`);
    assert.equal(shouldUseCodexRouter(eligible({
      sessionOptions: { ...eligible().sessionOptions, [flag]: "false" }
    })), false, `nonboolean ${flag}`);
  }
  for (const requestSource of [undefined, null, 1, {}, ""]) {
    assert.equal(shouldUseCodexRouter(eligible({
      sessionOptions: { ...eligible().sessionOptions, requestSource }
    })), false, `requestSource ${String(requestSource)}`);
  }
});
