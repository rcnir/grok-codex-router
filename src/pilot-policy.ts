export interface PilotSessionOptions {
  conversationId?: unknown;
  transcriptId?: unknown;
  isSummarizationSession?: unknown;
  isComputerUseSubagent?: unknown;
  isBrowserUseSubagent?: unknown;
  isSubagent?: unknown;
  isGroupMemberTurn?: unknown;
  requestSource?: unknown;
  [key: string]: unknown;
}

export interface CodexRouterPilotPolicyInput {
  enabled: boolean;
  allowlistedAgentIds: ReadonlySet<string>;
  executionHarness: unknown;
  sessionOptions?: PilotSessionOptions | undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim() ? value : undefined;
}

function isAuxiliaryWorkload(options: PilotSessionOptions): boolean {
  const flags = [
    options.isSummarizationSession,
    options.isComputerUseSubagent,
    options.isBrowserUseSubagent,
    options.isSubagent,
    options.isGroupMemberTurn
  ];
  if (flags.some((value) => typeof value !== "boolean" || value)) return true;
  if (typeof options.requestSource !== "string" || !options.requestSource) return true;
  return options.requestSource.toLowerCase().includes("automation");
}

export function shouldUseCodexRouter(input: CodexRouterPilotPolicyInput): boolean {
  if (input.enabled !== true || input.executionHarness !== "box") return false;

  const options = input.sessionOptions ?? {};
  if (isAuxiliaryWorkload(options)) return false;

  const agentId = nonEmptyString(options.conversationId);
  const transcriptId = nonEmptyString(options.transcriptId);
  if (!agentId || !transcriptId) return false;

  return input.allowlistedAgentIds.has(agentId);
}
