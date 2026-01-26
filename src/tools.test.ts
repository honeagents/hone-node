import { describe, it, expect } from "vitest";
import {
  createToolCallMessage,
  createToolResultMessage,
  extractOpenAIMessages,
  extractAnthropicMessages,
  extractGeminiMessages,
  toolResult,
  fromOpenAI,
  fromAnthropic,
  fromGemini,
} from "./tools";

describe("Tool tracking helpers", () => {
  describe("createToolCallMessage", () => {
    it("should create an assistant message with tool calls", () => {
      const toolCalls = [
        { id: "call_123", name: "get_weather", arguments: '{"location":"SF"}' },
      ];

      const message = createToolCallMessage(toolCalls);

      expect(message).toEqual({
        role: "assistant",
        content: "",
        tool_calls: toolCalls,
      });
    });

    it("should include content when provided", () => {
      const toolCalls = [
        { id: "call_123", name: "get_weather", arguments: '{"location":"SF"}' },
      ];

      const message = createToolCallMessage(toolCalls, "Let me check the weather");

      expect(message).toEqual({
        role: "assistant",
        content: "Let me check the weather",
        tool_calls: toolCalls,
      });
    });

    it("should handle multiple tool calls", () => {
      const toolCalls = [
        { id: "call_1", name: "get_weather", arguments: '{"location":"SF"}' },
        { id: "call_2", name: "get_time", arguments: '{"timezone":"PST"}' },
      ];

      const message = createToolCallMessage(toolCalls);

      expect(message.tool_calls).toHaveLength(2);
      expect(message.tool_calls![0].name).toBe("get_weather");
      expect(message.tool_calls![1].name).toBe("get_time");
    });
  });

  describe("createToolResultMessage", () => {
    it("should create a tool result message with string content", () => {
      const message = createToolResultMessage("call_123", "72°F and sunny");

      expect(message).toEqual({
        role: "tool",
        content: "72°F and sunny",
        tool_call_id: "call_123",
      });
    });

    it("should stringify object results", () => {
      const message = createToolResultMessage("call_123", { temp: 72, unit: "F" });

      expect(message).toEqual({
        role: "tool",
        content: '{"temp":72,"unit":"F"}',
        tool_call_id: "call_123",
      });
    });

    it("should stringify array results", () => {
      const message = createToolResultMessage("call_123", [1, 2, 3]);

      expect(message).toEqual({
        role: "tool",
        content: "[1,2,3]",
        tool_call_id: "call_123",
      });
    });

    it("should handle null and undefined", () => {
      expect(createToolResultMessage("call_123", null).content).toBe("null");
      expect(createToolResultMessage("call_123", undefined).content).toBe(undefined);
    });
  });

  describe("toolResult alias", () => {
    it("should be an alias for createToolResultMessage", () => {
      expect(toolResult).toBe(createToolResultMessage);
    });
  });

  describe("extractOpenAIMessages / fromOpenAI", () => {
    it("should extract a simple assistant message", () => {
      const response = {
        choices: [
          {
            message: {
              role: "assistant",
              content: "Hello!",
            },
          },
        ],
      };

      const messages = extractOpenAIMessages(response as any);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: "assistant",
        content: "Hello!",
      });
    });

    it("should extract message with tool calls", () => {
      const response = {
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_abc123",
                  type: "function" as const,
                  function: {
                    name: "get_weather",
                    arguments: '{"location":"San Francisco"}',
                  },
                },
              ],
            },
          },
        ],
      };

      const messages = extractOpenAIMessages(response as any);

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("assistant");
      expect(messages[0].content).toBe("");
      expect(messages[0].tool_calls).toHaveLength(1);
      expect(messages[0].tool_calls![0]).toEqual({
        id: "call_abc123",
        name: "get_weather",
        arguments: '{"location":"San Francisco"}',
      });
    });

    it("should handle multiple tool calls", () => {
      const response = {
        choices: [
          {
            message: {
              role: "assistant",
              content: "I'll check both",
              tool_calls: [
                {
                  id: "call_1",
                  type: "function" as const,
                  function: {
                    name: "get_weather",
                    arguments: '{"location":"SF"}',
                  },
                },
                {
                  id: "call_2",
                  type: "function" as const,
                  function: {
                    name: "get_time",
                    arguments: '{"timezone":"PST"}',
                  },
                },
              ],
            },
          },
        ],
      };

      const messages = extractOpenAIMessages(response as any);

      expect(messages[0].tool_calls).toHaveLength(2);
      expect(messages[0].tool_calls![0].name).toBe("get_weather");
      expect(messages[0].tool_calls![1].name).toBe("get_time");
    });

    it("should handle empty tool_calls array", () => {
      const response = {
        choices: [
          {
            message: {
              role: "assistant",
              content: "No tools needed",
              tool_calls: [],
            },
          },
        ],
      };

      const messages = extractOpenAIMessages(response as any);

      expect(messages[0].tool_calls).toBeUndefined();
    });

    it("fromOpenAI should be an alias", () => {
      expect(fromOpenAI).toBe(extractOpenAIMessages);
    });
  });

  describe("extractAnthropicMessages / fromAnthropic", () => {
    it("should extract a simple text message", () => {
      const response = {
        role: "assistant",
        content: [{ type: "text" as const, text: "Hello!" }],
      };

      const messages = extractAnthropicMessages(response as any);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: "assistant",
        content: "Hello!",
      });
    });

    it("should extract tool use blocks", () => {
      const response = {
        role: "assistant",
        content: [
          {
            type: "tool_use" as const,
            id: "toolu_123",
            name: "get_weather",
            input: { location: "San Francisco" },
          },
        ],
      };

      const messages = extractAnthropicMessages(response as any);

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("assistant");
      expect(messages[0].tool_calls).toHaveLength(1);
      expect(messages[0].tool_calls![0]).toEqual({
        id: "toolu_123",
        name: "get_weather",
        arguments: '{"location":"San Francisco"}',
      });
    });

    it("should combine text and tool use blocks", () => {
      const response = {
        role: "assistant",
        content: [
          { type: "text" as const, text: "Let me check the weather." },
          {
            type: "tool_use" as const,
            id: "toolu_123",
            name: "get_weather",
            input: { location: "SF" },
          },
        ],
      };

      const messages = extractAnthropicMessages(response as any);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("Let me check the weather.");
      expect(messages[0].tool_calls).toHaveLength(1);
    });

    it("should handle multiple text blocks", () => {
      const response = {
        role: "assistant",
        content: [
          { type: "text" as const, text: "First part." },
          { type: "text" as const, text: "Second part." },
        ],
      };

      const messages = extractAnthropicMessages(response as any);

      expect(messages[0].content).toBe("First part.\nSecond part.");
    });

    it("should handle multiple tool use blocks", () => {
      const response = {
        role: "assistant",
        content: [
          {
            type: "tool_use" as const,
            id: "toolu_1",
            name: "get_weather",
            input: { location: "SF" },
          },
          {
            type: "tool_use" as const,
            id: "toolu_2",
            name: "get_time",
            input: { timezone: "PST" },
          },
        ],
      };

      const messages = extractAnthropicMessages(response as any);

      expect(messages[0].tool_calls).toHaveLength(2);
      expect(messages[0].tool_calls![0].name).toBe("get_weather");
      expect(messages[0].tool_calls![1].name).toBe("get_time");
    });

    it("fromAnthropic should be an alias", () => {
      expect(fromAnthropic).toBe(extractAnthropicMessages);
    });
  });

  describe("extractGeminiMessages / fromGemini", () => {
    // Helper to wrap candidates in the GenerateContentResult structure
    const wrapGeminiResponse = (candidates: any[]) => ({
      response: { candidates },
    });

    it("should extract a simple text message", () => {
      const response = wrapGeminiResponse([
        {
          content: {
            role: "model",
            parts: [{ text: "Hello!" }],
          },
        },
      ]);

      const messages = extractGeminiMessages(response as any);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: "assistant",
        content: "Hello!",
      });
    });

    it("should extract function calls", () => {
      const response = wrapGeminiResponse([
        {
          content: {
            role: "model",
            parts: [
              {
                functionCall: {
                  name: "get_weather",
                  args: { location: "San Francisco" },
                },
              },
            ],
          },
        },
      ]);

      const messages = extractGeminiMessages(response as any);

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("assistant");
      expect(messages[0].tool_calls).toHaveLength(1);
      expect(messages[0].tool_calls![0].name).toBe("get_weather");
      expect(messages[0].tool_calls![0].arguments).toBe('{"location":"San Francisco"}');
      // Gemini IDs are generated
      expect(messages[0].tool_calls![0].id).toMatch(/^gemini_get_weather_0_/);
    });

    it("should combine text and function calls", () => {
      const response = wrapGeminiResponse([
        {
          content: {
            role: "model",
            parts: [
              { text: "Let me check." },
              {
                functionCall: {
                  name: "get_weather",
                  args: { location: "SF" },
                },
              },
            ],
          },
        },
      ]);

      const messages = extractGeminiMessages(response as any);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("Let me check.");
      expect(messages[0].tool_calls).toHaveLength(1);
    });

    it("should handle empty candidates", () => {
      const response = wrapGeminiResponse([]);
      const messages = extractGeminiMessages(response as any);
      expect(messages).toHaveLength(0);
    });

    it("should handle undefined candidates", () => {
      const response = { response: {} };
      const messages = extractGeminiMessages(response as any);
      expect(messages).toHaveLength(0);
    });

    it("should handle multiple function calls", () => {
      const response = wrapGeminiResponse([
        {
          content: {
            role: "model",
            parts: [
              {
                functionCall: {
                  name: "get_weather",
                  args: { location: "SF" },
                },
              },
              {
                functionCall: {
                  name: "get_time",
                  args: { timezone: "PST" },
                },
              },
            ],
          },
        },
      ]);

      const messages = extractGeminiMessages(response as any);

      expect(messages[0].tool_calls).toHaveLength(2);
      expect(messages[0].tool_calls![0].name).toBe("get_weather");
      expect(messages[0].tool_calls![1].name).toBe("get_time");
    });

    it("fromGemini should be an alias", () => {
      expect(fromGemini).toBe(extractGeminiMessages);
    });
  });
});
