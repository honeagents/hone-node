/**
 * Tool tracking helpers for the Hone SDK.
 *
 * These utilities help format tool calls and results for tracking conversations
 * that include function calling / tool use.
 */

import { Message, ToolCall } from "./types.js";

/**
 * Creates an assistant message containing tool calls.
 *
 * @param toolCalls - Array of tool calls the assistant is requesting
 * @param content - Optional text content alongside tool calls (usually empty)
 * @returns A Message object formatted for tool call requests
 *
 * @example
 * ```typescript
 * const message = createToolCallMessage([
 *   { id: "call_abc123", name: "get_weather", arguments: '{"location":"SF"}' }
 * ]);
 * // { role: "assistant", content: "", tool_calls: [...] }
 * ```
 */
export function createToolCallMessage(
  toolCalls: ToolCall[],
  content: string = ""
): Message {
  return {
    role: "assistant",
    content,
    tool_calls: toolCalls,
  };
}

/**
 * Creates a tool result message responding to a specific tool call.
 *
 * @param toolCallId - The ID of the tool call this result responds to
 * @param result - The result from executing the tool (will be stringified if not a string)
 * @returns A Message object formatted as a tool response
 *
 * @example
 * ```typescript
 * const message = createToolResultMessage("call_abc123", { temp: 72, unit: "F" });
 * // { role: "tool", content: '{"temp":72,"unit":"F"}', tool_call_id: "call_abc123" }
 * ```
 */
export function createToolResultMessage(
  toolCallId: string,
  result: unknown
): Message {
  const content = typeof result === "string" ? result : JSON.stringify(result);
  return {
    role: "tool",
    content,
    tool_call_id: toolCallId,
  };
}

/**
 * Extracts messages from an OpenAI chat completion response.
 *
 * Handles both regular assistant messages and messages with tool calls.
 *
 * @param response - The OpenAI chat completion response object
 * @returns Array of Message objects ready to be tracked
 *
 * @example
 * ```typescript
 * import OpenAI from "openai";
 *
 * const openai = new OpenAI();
 * const response = await openai.chat.completions.create({
 *   model: "gpt-4o",
 *   messages: [...],
 *   tools: [...]
 * });
 *
 * const messages = extractOpenAIMessages(response);
 * await hone.track("conversation", [...existingMessages, ...messages], { sessionId });
 * ```
 */
export function extractOpenAIMessages(response: {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
}): Message[] {
  const messages: Message[] = [];

  for (const choice of response.choices) {
    const msg = choice.message;
    const message: Message = {
      role: msg.role as Message["role"],
      content: msg.content ?? "",
    };

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      message.tool_calls = msg.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));
    }

    messages.push(message);
  }

  return messages;
}

/**
 * Extracts messages from an Anthropic Claude response.
 *
 * Handles both text responses and tool use blocks.
 *
 * @param response - The Anthropic message response object
 * @returns Array of Message objects ready to be tracked
 *
 * @example
 * ```typescript
 * import Anthropic from "@anthropic-ai/sdk";
 *
 * const anthropic = new Anthropic();
 * const response = await anthropic.messages.create({
 *   model: "claude-sonnet-4-20250514",
 *   messages: [...],
 *   tools: [...]
 * });
 *
 * const messages = extractAnthropicMessages(response);
 * await hone.track("conversation", [...existingMessages, ...messages], { sessionId });
 * ```
 */
export function extractAnthropicMessages(response: {
  role: string;
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: unknown }
  >;
}): Message[] {
  const messages: Message[] = [];

  const textBlocks = response.content.filter(
    (block): block is { type: "text"; text: string } => block.type === "text"
  );
  const toolUseBlocks = response.content.filter(
    (block): block is {
      type: "tool_use";
      id: string;
      name: string;
      input: unknown;
    } => block.type === "tool_use"
  );

  const textContent = textBlocks.map((b) => b.text).join("\n");

  if (toolUseBlocks.length > 0) {
    const toolCalls: ToolCall[] = toolUseBlocks.map((block) => ({
      id: block.id,
      name: block.name,
      arguments: JSON.stringify(block.input),
    }));

    messages.push({
      role: "assistant",
      content: textContent,
      tool_calls: toolCalls,
    });
  } else {
    messages.push({
      role: response.role as Message["role"],
      content: textContent,
    });
  }

  return messages;
}

/**
 * Extracts messages from a Google Gemini response.
 *
 * Handles both text responses and function call parts.
 * Note: Gemini doesn't provide unique IDs for function calls, so we generate
 * them using the format `gemini_{functionName}_{index}`.
 *
 * @param response - The Gemini GenerateContentResponse object
 * @returns Array of Message objects ready to be tracked
 *
 * @example
 * ```typescript
 * import { GoogleGenerativeAI } from "@google/generative-ai";
 *
 * const genAI = new GoogleGenerativeAI(apiKey);
 * const model = genAI.getGenerativeModel({ model: "gemini-pro" });
 *
 * const response = await model.generateContent({
 *   contents: [...],
 *   tools: [{ functionDeclarations: [...] }]
 * });
 *
 * const messages = extractGeminiMessages(response);
 * await hone.track("conversation", [...existingMessages, ...messages], { sessionId });
 * ```
 */
export function extractGeminiMessages(response: {
  candidates?: Array<{
    content?: {
      role?: string;
      parts?: Array<
        | { text: string }
        | { functionCall: { name: string; args: Record<string, unknown> } }
      >;
    };
  }>;
}): Message[] {
  const messages: Message[] = [];

  if (!response.candidates || response.candidates.length === 0) {
    return messages;
  }

  for (const candidate of response.candidates) {
    if (!candidate.content?.parts) continue;

    const textParts: string[] = [];
    const functionCalls: Array<{
      name: string;
      args: Record<string, unknown>;
    }> = [];

    for (const part of candidate.content.parts) {
      if ("text" in part) {
        textParts.push(part.text);
      } else if ("functionCall" in part) {
        functionCalls.push(part.functionCall);
      }
    }

    const textContent = textParts.join("\n");

    if (functionCalls.length > 0) {
      // Gemini doesn't provide tool call IDs, so we generate them
      const toolCalls: ToolCall[] = functionCalls.map((fc, index) => ({
        id: `gemini_${fc.name}_${index}_${Date.now()}`,
        name: fc.name,
        arguments: JSON.stringify(fc.args),
      }));

      messages.push({
        role: "assistant",
        content: textContent,
        tool_calls: toolCalls,
      });
    } else if (textContent) {
      messages.push({
        role:
          candidate.content.role === "model"
            ? "assistant"
            : (candidate.content.role as Message["role"]) || "assistant",
        content: textContent,
      });
    }
  }

  return messages;
}

// =============================================================================
// Short Aliases (Recommended)
// =============================================================================

/**
 * Short alias for createToolResultMessage.
 * Creates a tool result message responding to a specific tool call.
 *
 * @example
 * ```typescript
 * messages.push(toolResult(toolCall.id, { temp: 72 }));
 * ```
 */
export const toolResult = createToolResultMessage;

/**
 * Short alias for extractOpenAIMessages.
 * Extracts messages from an OpenAI chat completion response.
 *
 * @example
 * ```typescript
 * messages.push(...fromOpenAI(response));
 * ```
 */
export const fromOpenAI = extractOpenAIMessages;

/**
 * Short alias for extractAnthropicMessages.
 * Extracts messages from an Anthropic Claude response.
 *
 * @example
 * ```typescript
 * messages.push(...fromAnthropic(response));
 * ```
 */
export const fromAnthropic = extractAnthropicMessages;

/**
 * Short alias for extractGeminiMessages.
 * Extracts messages from a Google Gemini response.
 *
 * @example
 * ```typescript
 * messages.push(...fromGemini(response));
 * ```
 */
export const fromGemini = extractGeminiMessages;
