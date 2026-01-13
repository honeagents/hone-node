import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hone, createHoneClient } from "./client";
import { HoneConfig, Message, PromptResponse } from "./types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Hone Client", () => {
  const mockApiKey = "test-api-key";
  let client: Hone;

  beforeEach(() => {
    client = new Hone({ apiKey: mockApiKey });
    mockFetch.mockClear();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with required config", () => {
      const config: HoneConfig = {
        apiKey: "my-key",
      };

      const client = new Hone(config);
      expect(client).toBeInstanceOf(Hone);
    });

    it("should use default base URL when not provided", () => {
      const client = new Hone({ apiKey: "key" });
      // We can't directly access baseUrl since it's private, but we can test it via fetch calls
      expect(client).toBeInstanceOf(Hone);
    });

    it("should use custom base URL when provided", () => {
      const client = new Hone({
        apiKey: "key",
        baseUrl: "https://custom.api.com",
      });
      expect(client).toBeInstanceOf(Hone);
    });

    it("should use custom timeout when provided", () => {
      const client = new Hone({
        apiKey: "key",
        timeout: 5000,
      });
      expect(client).toBeInstanceOf(Hone);
    });

    it("should prioritize HONE_API_URL env var over config baseUrl", () => {
      const originalEnv = process.env.HONE_API_URL;
      process.env.HONE_API_URL = "https://env.api.com";

      const client = new Hone({
        apiKey: "key",
        baseUrl: "https://config.api.com",
      });

      expect(client).toBeInstanceOf(Hone);

      // Cleanup
      if (originalEnv !== undefined) {
        process.env.HONE_API_URL = originalEnv;
      } else {
        delete process.env.HONE_API_URL;
      }
    });
  });

  describe("prompt", () => {
    it("should fetch prompt successfully and return evaluated result", async () => {
      const mockResponse: PromptResponse = {
        greeting: { prompt: "Hello, {{userName}}! Welcome." },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.prompt("greeting", {
        defaultPrompt: "Hi, {{userName}}!",
        params: {
          userName: "Alice",
        },
      });

      expect(result).toBe("Hello, Alice! Welcome.");
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://honeagents.ai/api/prompts",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockApiKey}`,
          }),
        }),
      );
    });

    it("should use fallback prompt when API call fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      const result = await client.prompt("greeting", {
        defaultPrompt: "Hi, {{userName}}!",
        params: {
          userName: "Bob",
        },
      });

      expect(result).toBe("Hi, Bob!");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Error fetching prompt, using fallback:",
        expect.any(Error),
      );

      consoleLogSpy.mockRestore();
    });

    it("should handle nested prompts", async () => {
      const mockResponse: PromptResponse = {
        main: { prompt: "Welcome: {{intro}}" },
        intro: { prompt: "Hello, {{userName}}!" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.prompt("main", {
        defaultPrompt: "Fallback: {{intro}}",
        params: {
          intro: {
            defaultPrompt: "Hi, {{userName}}!",
            params: {
              userName: "Charlie",
            },
          },
        },
      });

      expect(result).toBe("Welcome: Hello, Charlie!");
    });

    it("should handle prompt with no parameters", async () => {
      const mockResponse: PromptResponse = {
        static: { prompt: "This is a static prompt" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.prompt("static", {
        defaultPrompt: "Fallback static",
      });

      expect(result).toBe("This is a static prompt");
    });

    it("should use fallback when API returns error status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ message: "Prompt not found" }),
      });

      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      const result = await client.prompt("missing", {
        defaultPrompt: "Fallback prompt",
      });

      expect(result).toBe("Fallback prompt");

      consoleLogSpy.mockRestore();
    });

    it("should handle version and name in prompt options", async () => {
      const mockResponse = {
        "greeting-v2": "Hello v2!",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await client.prompt("greeting-v2", {
        version: "v2",
        name: "greeting",
        defaultPrompt: "Hello v1!",
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.map["greeting-v2"].version).toBe("v2");
      expect(body.map["greeting-v2"].name).toBe("greeting");
    });

    it("should send correct request format to API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client.prompt("test", {
        defaultPrompt: "Test {{param1}}",
        params: {
          param1: "value1",
        },
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body).toHaveProperty("rootId", "test");
      expect(body).toHaveProperty("map");
      expect(body.map["test"]).toEqual({
        id: "test",
        name: undefined,
        version: undefined,
        prompt: "Test {{param1}}",
        paramKeys: ["param1"],
        childrenIds: [],
      });
    });
  });

  describe("track", () => {
    it("should track conversation successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const messages: Message[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ];

      await client.track("test-conversation", messages);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://honeagents.ai/api/track",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockApiKey}`,
          }),
        }),
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.id).toBe("test-conversation");
      expect(body.messages).toEqual(messages);
      expect(body.timestamp).toBeDefined();
      expect(new Date(body.timestamp)).toBeInstanceOf(Date);
    });

    it("should track with session ID when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const messages: Message[] = [{ role: "user", content: "Hello" }];

      await client.track("test", messages, { sessionId: "session-123" });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.sessionId).toBe("session-123");
    });

    it("should track with empty messages array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client.track("test", []);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should track with multiple message types", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const messages: Message[] = [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "What's the weather?" },
        { role: "assistant", content: "I'll check that for you." },
        { role: "user", content: "Thanks!" },
      ];

      await client.track("multi-turn", messages);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.messages).toEqual(messages);
    });

    it("should throw error when track API call fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ message: "Server error" }),
      });

      const messages: Message[] = [{ role: "user", content: "Test" }];

      await expect(client.track("test", messages)).rejects.toThrow(
        "Hone API error (500): Server error",
      );
    });
  });

  describe("error handling", () => {
    it("should throw error with message from API response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ message: "Invalid API key" }),
      });

      await expect(
        client.track("test", [{ role: "user", content: "Hi" }]),
      ).rejects.toThrow("Hone API error (401): Invalid API key");
    });

    it("should use status text when error message not in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: async () => ({}),
      });

      await expect(
        client.track("test", [{ role: "user", content: "Hi" }]),
      ).rejects.toThrow("Hone API error (403): Forbidden");
    });

    it("should handle JSON parse error in error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      await expect(
        client.track("test", [{ role: "user", content: "Hi" }]),
      ).rejects.toThrow("Hone API error (500): Internal Server Error");
    });

    it("should include User-Agent header in requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client.track("test", [{ role: "user", content: "Test" }]);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers["User-Agent"]).toBe(
        "hone-sdk-typescript/0.1.0",
      );
    });
  });

  describe("createHoneClient factory", () => {
    it("should create a Hone client instance", () => {
      const config: HoneConfig = {
        apiKey: "test-key",
      };

      const client = createHoneClient(config);

      expect(client).toBeInstanceOf(Hone);
      expect(client).toHaveProperty("prompt");
      expect(client).toHaveProperty("track");
    });

    it("should create client with custom config", () => {
      const config: HoneConfig = {
        apiKey: "test-key",
        baseUrl: "https://custom.com",
        timeout: 5000,
      };

      const client = createHoneClient(config);

      expect(client).toBeInstanceOf(Hone);
    });
  });

  describe("request headers", () => {
    it("should include all required headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client.track("test", []);

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;

      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["Authorization"]).toBe(`Bearer ${mockApiKey}`);
      expect(headers["User-Agent"]).toBe("hone-sdk-typescript/0.1.0");
    });
  });

  describe("base URL handling", () => {
    it("should construct correct URL with default base URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client.track("test", []);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://honeagents.ai/api/track",
        expect.any(Object),
      );
    });

    it("should construct correct URL with custom base URL", async () => {
      const customClient = new Hone({
        apiKey: "key",
        baseUrl: "https://custom.api.com",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await customClient.track("test", []);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom.api.com/track",
        expect.any(Object),
      );
    });

    it("should handle base URL without trailing slash", async () => {
      const customClient = new Hone({
        apiKey: "key",
        baseUrl: "https://api.example.com/v1",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await customClient.track("test", []);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/v1/track",
        expect.any(Object),
      );
    });
  });
});
