import { convertMessages } from "./message-wire.js";
import { convertTools } from "./tool-wire.js";
import { isRecord, sanitizeToolId, unwrapSandValue, type JsonObject } from "./sand-values.js";
import { RuntimeFault } from "./runtime-client.js";

export interface RuntimeToolSet {
  definitions: JsonObject[];
  hostNames: Map<string, string>;
}

export function dynamicTools(tools: unknown): RuntimeToolSet {
  if (tools == null) return { definitions: [], hostNames: new Map() };
  if (!Array.isArray(tools)) throw new RuntimeFault("INVALID_GROK_TOOL_SET");
  const names = new Map<string, string>();
  const converted = convertTools(tools) || [];
  if (converted.length !== tools.length) throw new RuntimeFault("UNSUPPORTED_GROK_TOOL_DEFINITION");
  const definitions = converted.map((tool, index) => {
    const original = tools[index];
    if (!isRecord(original) || typeof original.name !== "string" || !original.name ||
        typeof tool.name !== "string" || names.has(tool.name)) {
      throw new RuntimeFault("TOOL_NAME_COLLISION_OR_INVALID");
    }
    names.set(tool.name, original.name);
    return { type: "function", name: tool.name, description: tool.description,
      inputSchema: tool.parameters, deferLoading: false };
  });
  return { definitions, hostNames: names };
}

function records(messages: unknown[]): JsonObject[] {
  return messages.map((message) => {
    const value = unwrapSandValue(message);
    if (!isRecord(value)) throw new RuntimeFault("INVALID_GROK_MESSAGE");
    return value;
  });
}

function rawCallId(part: JsonObject, fallback: JsonObject = {}): string {
  const value = part.toolCallId ?? part.tool_call_id ?? part.call_id ?? part.id ??
    fallback.toolCallId ?? fallback.tool_call_id;
  if (typeof value !== "string" || !value) throw new RuntimeFault("INVALID_TRANSCRIPT_CALL_ID");
  return value;
}

function validateTranscript(messages: JsonObject[]): Map<string, string> {
  const callIds = new Map<string, string>();
  const addId = (value: string): void => {
    const legacy = sanitizeToolId(value);
    if (callIds.has(legacy) && callIds.get(legacy) !== value) throw new RuntimeFault("TRANSCRIPT_CALL_ID_COLLISION");
    callIds.set(legacy, value);
  };
  for (const message of messages) {
    if (!["system", "developer", "assistant", "user", "tool", "toolResult"].includes(String(message.role))) {
      throw new RuntimeFault("UNSUPPORTED_TRANSCRIPT_ROLE");
    }
    if (message.role === "tool" || message.role === "toolResult") {
      for (const result of hostToolResults([message]).results) addId(result.callId);
      continue;
    }
    if (message.content !== undefined && typeof message.content !== "string" && !Array.isArray(message.content)) {
      throw new RuntimeFault("UNSUPPORTED_TRANSCRIPT_CONTENT");
    }
    for (const raw of Array.isArray(message.content) ? message.content : []) {
      if (!isRecord(raw)) throw new RuntimeFault("UNSUPPORTED_TRANSCRIPT_CONTENT");
      const type = raw.type ?? raw.kind;
      if (["text", "input_text", "output_text"].includes(String(type))) {
        if (typeof (raw.text ?? raw.content) !== "string") throw new RuntimeFault("UNSUPPORTED_TRANSCRIPT_CONTENT");
      } else if (message.role === "user" && ["image", "image_url", "input_image"].includes(String(type))) {
        const url = imageUrl(raw);
        if (!url || !validImage(url)) throw new RuntimeFault("IMAGE_SOURCE_UNAVAILABLE");
        // Canonicalize the supported alias before invoking the preserved upstream converter.
        raw.image_url = url;
      } else if (message.role === "assistant" &&
          (["tool-call", "tool_use", "function_call"].includes(String(type)) || isRecord(raw.function))) {
        addId(rawCallId(raw));
      } else if (["reasoning", "thinking"].includes(String(type))) {
        throw new RuntimeFault("PRIVATE_REASONING_TRANSCRIPT_FORBIDDEN");
      } else throw new RuntimeFault("UNSUPPORTED_TRANSCRIPT_CONTENT");
    }
    for (const field of ["toolCalls", "tool_calls"]) {
      if (message[field] === undefined) continue;
      if (message.role !== "assistant" || !Array.isArray(message[field])) throw new RuntimeFault("UNSUPPORTED_TRANSCRIPT_CONTENT");
      for (const raw of message[field] as unknown[]) {
        if (!isRecord(raw) || !(["tool-call", "tool_use", "function_call"].includes(String(raw.type ?? raw.kind)) || isRecord(raw.function))) {
          throw new RuntimeFault("UNSUPPORTED_TRANSCRIPT_CONTENT");
        }
        addId(rawCallId(raw));
      }
    }
  }
  return callIds;
}

function userInput(content: unknown): JsonObject[] {
  if (!Array.isArray(content) || content.length === 0) throw new RuntimeFault("CURRENT_USER_INPUT_REQUIRED");
  return content.map((part) => {
    if (!isRecord(part)) throw new RuntimeFault("UNSUPPORTED_USER_INPUT");
    if (part.type === "input_text" && typeof part.text === "string" && part.text) {
      return { type: "text", text: part.text };
    }
    if (part.type === "input_image" && typeof part.image_url === "string" && validImage(part.image_url)) {
      return { type: "image", url: part.image_url, detail: part.detail || "auto" };
    }
    throw new RuntimeFault("UNSUPPORTED_USER_INPUT");
  });
}

export function initialRuntimeInput(messages: unknown[]): {
  developerInstructions: string; priorItems: unknown[]; currentInput: JsonObject[];
} {
  const plain = records(messages);
  const last = plain.at(-1);
  if (last?.role !== "user") throw new RuntimeFault("CURRENT_USER_INPUT_REQUIRED");
  // Reject missing image sources rather than accepting message-wire's legacy
  // text omission fallback, which is retained for upstream wire compatibility.
  if (Array.isArray(last.content)) {
    for (const part of last.content) {
      if (!isRecord(part)) throw new RuntimeFault("UNSUPPORTED_USER_INPUT");
      if (["image", "image_url", "input_image"].includes(String(part.type))) {
        const url = imageUrl(part);
        if (!url || !validImage(url)) throw new RuntimeFault("IMAGE_SOURCE_UNAVAILABLE");
      } else if (!["text", "input_text"].includes(String(part.type)) || typeof part.text !== "string" || !part.text) {
        throw new RuntimeFault("UNSUPPORTED_USER_INPUT");
      }
    }
  } else if (typeof last.content !== "string" || !last.content) {
    throw new RuntimeFault("UNSUPPORTED_USER_INPUT");
  }
  const callIds = validateTranscript(plain);
  const converted = convertMessages(plain);
  const current = converted.input.at(-1);
  if (!isRecord(current) || current.role !== "user") throw new RuntimeFault("CURRENT_USER_INPUT_REQUIRED");
  const priorItems = converted.input.slice(0, -1).map((item) => {
    // Raw reasoning and encrypted/private state are never accepted as transcript.
    if (!isRecord(item) || ![undefined, "message", "function_call", "function_call_output"].includes(item.type as string | undefined)) {
      throw new RuntimeFault("UNSUPPORTED_TRANSCRIPT_ITEM");
    }
    if (item.type === "function_call" || item.type === "function_call_output") {
      if (typeof item.call_id !== "string" || !callIds.has(item.call_id)) throw new RuntimeFault("TRANSCRIPT_CALL_ID_UNMAPPED");
      return { ...item, call_id: callIds.get(item.call_id)! };
    }
    return { type: "message", ...item };
  });
  return { developerInstructions: converted.instructions, priorItems, currentInput: userInput(current.content) };
}

function validImage(url: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(url) || /^data:image\/[^;,]+;base64,[a-z0-9+/]+={0,2}$/i.test(url);
}

function imageUrl(part: JsonObject): string | undefined {
  const nested = isRecord(part.image_url) ? part.image_url.url : part.image_url;
  const value = nested ?? part.imageUrl ?? part.url ?? part.image ?? part.data;
  if (typeof value !== "string") return undefined;
  const mime = part.mimeType ?? part.mime_type;
  return !/^(https?:|data:)/i.test(value) && typeof mime === "string" && mime.startsWith("image/")
    ? `data:${mime};base64,${value}` : value;
}

export interface HostToolResult {
  callId: string;
  name?: string;
  response: { success: boolean; contentItems: JsonObject[] };
}

function outputContent(value: unknown): JsonObject[] {
  if (typeof value === "string") return [{ type: "inputText", text: value }];
  if (Array.isArray(value)) return value.flatMap(outputContent);
  if (isRecord(value)) {
    const type = value.type;
    if (["text", "inputText", "input_text", "output_text"].includes(String(type)) && typeof value.text === "string") {
      return [{ type: "inputText", text: value.text }];
    }
    if (["image", "image_url", "inputImage", "input_image"].includes(String(type))) {
      const url = imageUrl(value);
      if (!url || !validImage(url)) throw new RuntimeFault("INVALID_TOOL_RESULT_IMAGE");
      return [{ type: "inputImage", imageUrl: url }];
    }
    if (Array.isArray(value.content)) return outputContent(value.content);
    if (type === "reasoning" || type === "thinking") throw new RuntimeFault("PRIVATE_REASONING_RESULT_FORBIDDEN");
  }
  return [{ type: "inputText", text: JSON.stringify(value ?? null) }];
}

export function hostToolResults(messages: unknown[]): { results: HostToolResult[]; assistantEchoes: JsonObject[] } {
  const results: HostToolResult[] = [];
  const assistantEchoes: JsonObject[] = [];
  for (const message of records(messages)) {
    if (message.role === "assistant") { assistantEchoes.push(message); continue; }
    if (message.role !== "tool" && message.role !== "toolResult") throw new RuntimeFault("TOOL_RESULT_EXPECTED");
    const parts = Array.isArray(message.content) && message.content.some((part) =>
      isRecord(part) && ["tool-result", "tool_result"].includes(String(part.type))) ? message.content : [message];
    for (const part of parts) {
      if (!isRecord(part)) throw new RuntimeFault("INVALID_TOOL_RESULT");
      const callId = part.toolCallId ?? part.tool_call_id ?? part.call_id ?? part.id ??
        message.toolCallId ?? message.tool_call_id;
      const name = part.toolName ?? part.tool_name ?? part.name ?? message.toolName;
      if (typeof callId !== "string" || !callId || (name !== undefined && typeof name !== "string")) {
        throw new RuntimeFault("INVALID_TOOL_RESULT_IDENTITY");
      }
      const value = part.result ?? part.output ?? part.value ?? part.content ?? "";
      const failed = part.isError === true || part.is_error === true || message.isError === true ||
        (isRecord(value) && (value.isError === true || value.is_error === true));
      const result: HostToolResult = { callId, response: { success: !failed, contentItems: outputContent(value) } };
      if (typeof name === "string") result.name = name;
      results.push(result);
    }
  }
  return { results, assistantEchoes };
}
