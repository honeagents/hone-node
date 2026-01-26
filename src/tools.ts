/**
 * Tool tracking helpers for the Hone SDK.
 *
 * These utilities help format tool calls and results for tracking conversations
 * that include function calling / tool use.
 */

import { Message, ToolCall } from "./types.js";

// Import types from provider SDKs (dev dependencies)
import type { ChatCompletion } from "openai/resources/chat/completions";
import type { Message as AnthropicMessageResponse } from "@anthropic-ai/sdk/resources/messages";
import type { GenerateContentResult } from "@google/generative-ai";

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
export function extractOpenAIMessages(response: ChatCompletion): Message[] {
  const messages: Message[] = [];

  for (const choice of response.choices) {
    const msg = choice.message;
    const message: Message = {
      role: msg.role as Message["role"],
      content: msg.content ?? "",
    };

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      message.tool_calls = msg.tool_calls
        .filter((tc): tc is typeof tc & { type: "function" } => tc.type === "function")
        .map((tc) => ({
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
export function extractAnthropicMessages(response: AnthropicMessageResponse): Message[] {
  const messages: Message[] = [];

  // Extract text from text blocks
  const textContent = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("\n");

  // Extract tool use blocks
  const toolUseBlocks = response.content.filter(
    (block) => block.type === "tool_use"
  ) as Array<{ type: "tool_use"; id: string; name: string; input: unknown }>;

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
export function extractGeminiMessages(response: GenerateContentResult): Message[] {
  const messages: Message[] = [];

  const candidates = response.response.candidates;
  if (!candidates || candidates.length === 0) {
    return messages;
  }

  for (const candidate of candidates) {
    if (!candidate.content?.parts) continue;

    const textParts: string[] = [];
    const functionCalls: Array<{
      name: string;
      args: Record<string, unknown>;
    }> = [];

    for (const part of candidate.content.parts) {
      if ("text" in part && part.text) {
        textParts.push(part.text);
      } else if ("functionCall" in part && part.functionCall) {
        functionCalls.push({
          name: part.functionCall.name,
          args: (part.functionCall.args || {}) as Record<string, unknown>,
        });
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
// Input Message Normalizers (for zero-friction tracking)
// =============================================================================

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import type { Content } from "@google/generative-ai";

/**
 * Normalizes OpenAI input messages to Hone's Message format.
 *
 * @param messages - Array of OpenAI ChatCompletionMessageParam
 * @returns Array of normalized Message objects
 */
export function normalizeOpenAIMessages(messages: ChatCompletionMessageParam[]): Message[] {
  const result: Message[] = [];

  for (const m of messages) {
    // Handle different message types
    if (m.role === "system" || m.role === "user" || m.role === "assistant") {
      const content = typeof m.content === "string"
        ? m.content
        : Array.isArray(m.content)
          ? m.content
              .filter((c): c is { type: "text"; text: string } => c.type === "text")
              .map((c) => c.text)
              .join("\n")
          : "";

      const message: Message = {
        role: m.role,
        content: content || "",
      };

      // Handle tool calls on assistant messages
      if (m.role === "assistant" && "tool_calls" in m && m.tool_calls) {
        message.tool_calls = m.tool_calls
          .filter((tc): tc is typeof tc & { type: "function" } => tc.type === "function")
          .map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          }));
      }

      result.push(message);
    } else if (m.role === "tool") {
      result.push({
        role: "tool",
        content: typeof m.content === "string" ? m.content : "",
        tool_call_id: m.tool_call_id,
      });
    }
  }

  return result;
}

/**
 * Normalizes Anthropic input messages to Hone's Message format.
 * Note: System prompt should be passed separately to track().
 *
 * @param messages - Array of Anthropic MessageParam
 * @returns Array of normalized Message objects
 */
export function normalizeAnthropicMessages(messages: MessageParam[]): Message[] {
  const result: Message[] = [];

  for (const m of messages) {
    if (typeof m.content === "string") {
      result.push({
        role: m.role as "user" | "assistant",
        content: m.content,
      });
    } else if (Array.isArray(m.content)) {
      // Handle content blocks
      const textParts: string[] = [];
      const toolCalls: ToolCall[] = [];
      const toolResults: Array<{ tool_use_id: string; content: string }> = [];

      for (const block of m.content) {
        if (block.type === "text") {
          textParts.push(block.text);
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: JSON.stringify(block.input),
          });
        } else if (block.type === "tool_result") {
          const content = typeof block.content === "string"
            ? block.content
            : Array.isArray(block.content)
              ? block.content
                  .filter((c): c is { type: "text"; text: string } => c.type === "text")
                  .map((c) => c.text)
                  .join("\n")
              : "";
          toolResults.push({
            tool_use_id: block.tool_use_id,
            content,
          });
        }
      }

      // Add text/tool_calls as assistant or user message
      if (textParts.length > 0 || toolCalls.length > 0) {
        const message: Message = {
          role: m.role as "user" | "assistant",
          content: textParts.join("\n"),
        };
        if (toolCalls.length > 0) {
          message.tool_calls = toolCalls;
        }
        result.push(message);
      }

      // Add tool results as separate tool messages
      for (const tr of toolResults) {
        result.push({
          role: "tool",
          content: tr.content,
          tool_call_id: tr.tool_use_id,
        });
      }
    }
  }

  return result;
}

/**
 * Normalizes Gemini input contents to Hone's Message format.
 * Note: System instruction should be passed separately to track().
 *
 * @param contents - Array of Gemini Content
 * @returns Array of normalized Message objects
 */
export function normalizeGeminiContents(contents: Content[]): Message[] {
  const result: Message[] = [];

  for (const c of contents) {
    const textParts: string[] = [];
    const toolCalls: ToolCall[] = [];
    const toolResults: Array<{ name: string; content: string }> = [];

    for (const part of c.parts) {
      if ("text" in part && part.text) {
        textParts.push(part.text);
      } else if ("functionCall" in part && part.functionCall) {
        toolCalls.push({
          id: `gemini_${part.functionCall.name}_${Date.now()}`,
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args),
        });
      } else if ("functionResponse" in part && part.functionResponse) {
        toolResults.push({
          name: part.functionResponse.name,
          content: JSON.stringify(part.functionResponse.response),
        });
      }
    }

    // Map Gemini's "model" role to "assistant"
    const role = c.role === "model" ? "assistant" : "user";

    if (textParts.length > 0 || toolCalls.length > 0) {
      const message: Message = {
        role: role as Message["role"],
        content: textParts.join("\n"),
      };
      if (toolCalls.length > 0) {
        message.tool_calls = toolCalls;
      }
      result.push(message);
    }

    // Add function responses as tool messages
    for (const tr of toolResults) {
      result.push({
        role: "tool",
        content: tr.content,
        tool_call_id: tr.name, // Gemini uses function name, not ID
      });
    }
  }

  return result;
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
