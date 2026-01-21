import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hone, createHoneClient } from "./client";
import { HoneConfig, Message, AgentResponse } from "./types";

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

  describe("agent", () => {
    it("should fetch agent successfully and return evaluated result with hyperparameters", async () => {
      const mockResponse: AgentResponse = {
        greeting: {
          prompt: "Hello, {{userName}}! Welcome.",
          model: "gpt-4",
          provider: "openai",
          temperature: 0.7,
          maxTokens: 1000,
          topP: 0.9,
          frequencyPenalty: 0.1,
          presencePenalty: 0.2,
          stopSequences: ["END"],
          tools: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entities: mockResponse }),
      });

      const result = await client.agent("greeting", {
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "Hi, {{userName}}!",
        params: {
          userName: "Alice",
        },
      });

      expect(result.systemPrompt).toBe("Hello, Alice! Welcome.");
      expect(result.model).toBe("gpt-4");
      expect(result.provider).toBe("openai");
      expect(result.temperature).toBe(0.7);
      expect(result.maxTokens).toBe(1000);
      expect(result.topP).toBe(0.9);
      expect(result.frequencyPenalty).toBe(0.1);
      expect(result.presencePenalty).toBe(0.2);
      expect(result.stopSequences).toEqual(["END"]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://honeagents.ai/api/sync_entities",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "x-api-key": mockApiKey,
          }),
        }),
      );
    });

    it("should use fallback prompt and options when API call fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      const result = await client.agent("greeting", {
        model: "gpt-3.5-turbo",
        provider: "openai",
        defaultPrompt: "Hi, {{userName}}!",
        temperature: 0.5,
        params: {
          userName: "Bob",
        },
      });

      expect(result.systemPrompt).toBe("Hi, Bob!");
      expect(result.model).toBe("gpt-3.5-turbo");
      expect(result.provider).toBe("openai");
      expect(result.temperature).toBe(0.5);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Error fetching agent, using fallback:",
        expect.any(Error),
      );

      consoleLogSpy.mockRestore();
    });

    it("should handle nested agents", async () => {
      const mockResponse: AgentResponse = {
        main: { prompt: "Welcome: {{intro}}", model: "gpt-4", provider: "openai", temperature: null, maxTokens: null, topP: null, frequencyPenalty: null, presencePenalty: null, stopSequences: [], tools: [] },
        intro: { prompt: "Hello, {{userName}}!", model: "gpt-4", provider: "openai", temperature: null, maxTokens: null, topP: null, frequencyPenalty: null, presencePenalty: null, stopSequences: [], tools: [] },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entities: mockResponse }),
      });

      const result = await client.agent("main", {
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "Fallback: {{intro}}",
        params: {
          intro: {
            model: "gpt-4",
            provider: "openai",
            defaultPrompt: "Hi, {{userName}}!",
            params: {
              userName: "Charlie",
            },
          },
        },
      });

      expect(result.systemPrompt).toBe("Welcome: Hello, Charlie!");
    });

    it("should handle agent with no parameters", async () => {
      const mockResponse: AgentResponse = {
        static: { prompt: "This is a static prompt", model: "claude-3", provider: "anthropic", temperature: null, maxTokens: null, topP: null, frequencyPenalty: null, presencePenalty: null, stopSequences: [], tools: [] },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entities: mockResponse }),
      });

      const result = await client.agent("static", {
        model: "claude-3",
        provider: "anthropic",
        defaultPrompt: "Fallback static",
      });

      expect(result.systemPrompt).toBe("This is a static prompt");
      expect(result.model).toBe("claude-3");
    });

    it("should use fallback when API returns error status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ message: "Agent not found" }),
      });

      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      const result = await client.agent("missing", {
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "Fallback prompt",
      });

      expect(result.systemPrompt).toBe("Fallback prompt");

      consoleLogSpy.mockRestore();
    });

    it("should handle majorVersion and name in agent options", async () => {
      const mockResponse = {
        "greeting-v2": { prompt: "Hello v2!" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entities: mockResponse }),
      });

      await client.agent("greeting-v2", {
        model: "gpt-4",
        provider: "openai",
        majorVersion: 2,
        name: "greeting",
        defaultPrompt: "Hello v1!",
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.entities.map["greeting-v2"].majorVersion).toBe(2);
      expect(body.entities.map["greeting-v2"].name).toBe("greeting");
    });

    it("should send correct request format to API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entities: {} }),
      });

      await client.agent("test", {
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "Test {{param1}}",
        params: {
          param1: "value1",
        },
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.entities).toHaveProperty("rootId", "test");
      expect(body.entities).toHaveProperty("map");
      // Check key fields - the format omits undefined values and includes childrenTypes
      const testEntity = body.entities.map["test"];
      expect(testEntity.id).toBe("test");
      expect(testEntity.type).toBe("agent");
      expect(testEntity.prompt).toBe("Test {{param1}}");
      expect(testEntity.paramKeys).toEqual(["param1"]);
      expect(testEntity.childrenIds).toEqual([]);
      expect(testEntity.model).toBe("gpt-4");
      expect(testEntity.provider).toBe("openai");
    });

    it("should send hyperparameters in request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entities: {} }),
      });

      await client.agent("test", {
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "Test prompt",
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9,
        frequencyPenalty: 0.5,
        presencePenalty: 0.3,
        stopSequences: ["END"],
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.entities.map["test"].model).toBe("gpt-4");
      expect(body.entities.map["test"].provider).toBe("openai");
      expect(body.entities.map["test"].temperature).toBe(0.7);
      expect(body.entities.map["test"].maxTokens).toBe(1000);
      expect(body.entities.map["test"].topP).toBe(0.9);
      expect(body.entities.map["test"].frequencyPenalty).toBe(0.5);
      expect(body.entities.map["test"].presencePenalty).toBe(0.3);
      expect(body.entities.map["test"].stopSequences).toEqual(["END"]);
    });

    it("should return null for missing hyperparameters from API", async () => {
      // API returns only model and temperature, others are null
      const mockResponse: AgentResponse = {
        test: {
          prompt: "Hello",
          model: "gpt-4",
          provider: "openai",
          temperature: 0.5,
          maxTokens: null,
          topP: null,
          frequencyPenalty: null,
          presencePenalty: null,
          stopSequences: [],
          tools: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entities: mockResponse }),
      });

      const result = await client.agent("test", {
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "Hello",
      });

      expect(result.systemPrompt).toBe("Hello");
      expect(result.model).toBe("gpt-4");
      expect(result.provider).toBe("openai");
      expect(result.temperature).toBe(0.5);
      expect(result.maxTokens).toBeNull();
      expect(result.topP).toBeNull();
      expect(result.frequencyPenalty).toBeNull();
      expect(result.presencePenalty).toBeNull();
      expect(result.stopSequences).toEqual([]);
    });

    it("should prefer API hyperparameters over SDK defaults", async () => {
      // API returns different values than SDK defaults
      const mockResponse: AgentResponse = {
        test: {
          prompt: "Hello",
          model: "claude-3-opus",
          provider: "anthropic",
          temperature: 0.9,
          maxTokens: 2000,
          topP: 0.95,
          frequencyPenalty: 0.2,
          presencePenalty: 0.3,
          stopSequences: ["STOP"],
          tools: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entities: mockResponse }),
      });

      // SDK provides different defaults
      const result = await client.agent("test", {
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "Hello",
        temperature: 0.5,
        maxTokens: 1000,
        topP: 0.8,
        frequencyPenalty: 0.1,
        presencePenalty: 0.1,
        stopSequences: ["END"],
      });

      // API values should win
      expect(result.model).toBe("claude-3-opus");
      expect(result.provider).toBe("anthropic");
      expect(result.temperature).toBe(0.9);
      expect(result.maxTokens).toBe(2000);
      expect(result.topP).toBe(0.95);
      expect(result.frequencyPenalty).toBe(0.2);
      expect(result.presencePenalty).toBe(0.3);
      expect(result.stopSequences).toEqual(["STOP"]);
    });

    it("should use SDK defaults when API returns null hyperparameters", async () => {
      // API explicitly returns null for hyperparameters (except model/provider which come from SDK)
      const mockResponse: AgentResponse = {
        test: {
          prompt: "Hello",
          model: null,
          provider: null,
          temperature: null,
          maxTokens: null,
          topP: null,
          frequencyPenalty: null,
          presencePenalty: null,
          stopSequences: [],
          tools: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entities: mockResponse }),
      });

      // SDK provides defaults
      const result = await client.agent("test", {
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "Hello",
        temperature: 0.7,
        maxTokens: 1000,
      });

      // SDK defaults should be used since API returned null
      expect(result.model).toBe("gpt-4");
      expect(result.provider).toBe("openai");
      expect(result.temperature).toBe(0.7);
      expect(result.maxTokens).toBe(1000);
      // These weren't specified in SDK either, so remain null
      expect(result.topP).toBeNull();
      expect(result.frequencyPenalty).toBeNull();
      expect(result.presencePenalty).toBeNull();
      expect(result.stopSequences).toEqual([]);
    });

    it("should return SDK model/provider even when API returns null", async () => {
      const mockResponse: AgentResponse = {
        test: {
          prompt: "Hello",
          model: null,
          provider: null,
          temperature: null,
          maxTokens: null,
          topP: null,
          frequencyPenalty: null,
          presencePenalty: null,
          stopSequences: [],
          tools: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entities: mockResponse }),
      });

      // model and provider are required in SDK
      const result = await client.agent("test", {
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "Hello",
      });

      expect(result.systemPrompt).toBe("Hello");
      // model and provider come from SDK since API returned null
      expect(result.model).toBe("gpt-4");
      expect(result.provider).toBe("openai");
      expect(result.temperature).toBeNull();
      expect(result.maxTokens).toBeNull();
      expect(result.topP).toBeNull();
      expect(result.frequencyPenalty).toBeNull();
      expect(result.presencePenalty).toBeNull();
      expect(result.stopSequences).toEqual([]);
    });

    it("should return SDK defaults in fallback when API fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      const result = await client.agent("test", {
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "Hello {{name}}",
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9,
        frequencyPenalty: 0.1,
        presencePenalty: 0.2,
        stopSequences: ["END"],
        params: { name: "World" },
      });

      expect(result.systemPrompt).toBe("Hello World");
      expect(result.model).toBe("gpt-4");
      expect(result.provider).toBe("openai");
      expect(result.temperature).toBe(0.7);
      expect(result.maxTokens).toBe(1000);
      expect(result.topP).toBe(0.9);
      expect(result.frequencyPenalty).toBe(0.1);
      expect(result.presencePenalty).toBe(0.2);
      expect(result.stopSequences).toEqual(["END"]);

      consoleLogSpy.mockRestore();
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

      await client.track("test-conversation", messages, { sessionId: "session-xyz" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://honeagents.ai/api/insert_runs",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "x-api-key": mockApiKey,
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

      await client.track("test", [], { sessionId: "session-empty" });

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

      await client.track("multi-turn", messages, { sessionId: "session-multi" });

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

      await expect(client.track("test", messages, { sessionId: "session-123" })).rejects.toThrow(
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
        client.track("test", [{ role: "user", content: "Hi" }], { sessionId: "session-123" }),
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
        client.track("test", [{ role: "user", content: "Hi" }], { sessionId: "session-123" }),
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
        client.track("test", [{ role: "user", content: "Hi" }], { sessionId: "session-123" }),
      ).rejects.toThrow("Hone API error (500): Internal Server Error");
    });

    it("should include User-Agent header in requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client.track("test", [{ role: "user", content: "Test" }], { sessionId: "session-123" });

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
      expect(client).toHaveProperty("agent");
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

      await client.track("test", [], { sessionId: "session-123" });

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;

      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["x-api-key"]).toBe(mockApiKey);
      expect(headers["User-Agent"]).toBe("hone-sdk-typescript/0.1.0");
    });
  });

  describe("base URL handling", () => {
    it("should construct correct URL with default base URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client.track("test", [], { sessionId: "session-123" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://honeagents.ai/api/insert_runs",
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

      await customClient.track("test", [], { sessionId: "session-123" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom.api.com/insert_runs",
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

      await customClient.track("test", [], { sessionId: "session-123" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/v1/insert_runs",
        expect.any(Object),
      );
    });
  });
});
