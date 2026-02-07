// client.ts
import {
  GetAgentOptions,
  GetToolOptions,
  GetTextPromptOptions,
  HoneClient,
  HoneConfig,
  Message,
  AgentResult,
  ToolResult,
  TextPromptResult,
  EntityV2Request,
  EntityV2Response,
  TrackConversationOptions,
  TrackRequest,
  TrackResponse,
  TrackInput,
} from "./types";
import {
  extractOpenAIMessages,
  extractAnthropicMessages,
  extractGeminiMessages,
  normalizeOpenAIMessages,
  normalizeAnthropicMessages,
  normalizeGeminiContents,
} from "./tools";
import {
  formatEntityV2Request,
  getAgentNode,
  getToolNode,
  getTextPromptNode,
} from "./agent";

const DEFAULT_BASE_URL = "https://honeagents.ai/api";
const DEFAULT_TIMEOUT = 10000;

export class Hone implements HoneClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: HoneConfig) {
    this.apiKey = config.apiKey;
    // Allow override from env var for local dev, then config, then default
    this.baseUrl =
      process.env.HONE_API_URL || config.baseUrl || DEFAULT_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  private async makeRequest<Request, Response>(
    endpoint: string,
    method: string = "GET",
    body?: Request,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log(`Hone API Request: ${method} ${url}`);
      const response = await fetch(url, {
        method,
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
          "User-Agent": "hone-sdk-typescript/0.1.0",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(
          `Hone API error (${response.status}): ${errorData.error || errorData.message || response.statusText}`,
        );
      }

      return (await response.json()) as Response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Hone API request timed out after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  async agent<TExtra extends Record<string, unknown> = Record<string, unknown>>(
    id: string,
    options: GetAgentOptions<TExtra>
  ): Promise<AgentResult<TExtra>> {
    const node = getAgentNode(id, options);

    // Format request using V2 nested structure
    const request = formatEntityV2Request(node);

    // Include extra data in the request
    if (options.extra && request.data) {
      Object.assign(request.data, options.extra);
    }

    // Call V2 endpoint - server handles evaluation
    const response = await this.makeRequest<EntityV2Request, EntityV2Response>(
      "/v2/entities",
      "POST",
      request
    );

    // Extract extra data from response
    const { model, provider, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, stopSequences, tools, ...extra } = response.data;
    const extraData = extra as TExtra;

    // V2 response includes evaluated prompt - no client-side evaluation needed
    return {
      systemPrompt: response.evaluatedPrompt,
      model: model ?? options.model,
      provider: provider ?? options.provider,
      temperature: temperature ?? options.temperature ?? null,
      maxTokens: maxTokens ?? options.maxTokens ?? null,
      topP: topP ?? options.topP ?? null,
      frequencyPenalty: frequencyPenalty ?? options.frequencyPenalty ?? null,
      presencePenalty: presencePenalty ?? options.presencePenalty ?? null,
      stopSequences: stopSequences ?? options.stopSequences ?? [],
      tools: tools ?? options.tools ?? [],
      ...extraData,
    } as AgentResult<TExtra>;
  }

  async tool(id: string, options: GetToolOptions): Promise<ToolResult> {
    const node = getToolNode(id, options);

    // Format request using V2 nested structure
    const request = formatEntityV2Request(node);

    // Call V2 endpoint - server handles evaluation
    const response = await this.makeRequest<EntityV2Request, EntityV2Response>(
      "/v2/entities",
      "POST",
      request
    );

    // V2 response includes evaluated prompt - no client-side evaluation needed
    return {
      prompt: response.evaluatedPrompt,
    };
  }

  async prompt(id: string, options: GetTextPromptOptions): Promise<TextPromptResult> {
    const node = getTextPromptNode(id, options);

    // Format request using V2 nested structure
    const request = formatEntityV2Request(node);

    // Call V2 endpoint - server handles evaluation
    const response = await this.makeRequest<EntityV2Request, EntityV2Response>(
      "/v2/entities",
      "POST",
      request
    );

    // V2 response includes evaluated prompt - no client-side evaluation needed
    return {
      text: response.evaluatedPrompt,
    };
  }

  async track(
    id: string,
    input: TrackInput,
    options: TrackConversationOptions,
  ): Promise<void> {
    let normalizedMessages: Message[];

    if (Array.isArray(input)) {
      // Already in normalized format
      normalizedMessages = input;
    } else if (input.provider === "openai") {
      // OpenAI format: normalize input messages + extract response
      const inputMessages = normalizeOpenAIMessages(input.messages);
      const responseMessages = extractOpenAIMessages(input.response);
      normalizedMessages = [...inputMessages, ...responseMessages];
    } else if (input.provider === "anthropic") {
      // Anthropic format: add system + normalize input messages + extract response
      const systemMessage: Message[] = input.system
        ? [{ role: "system", content: input.system }]
        : [];
      const inputMessages = normalizeAnthropicMessages(input.messages);
      const responseMessages = extractAnthropicMessages(input.response);
      normalizedMessages = [...systemMessage, ...inputMessages, ...responseMessages];
    } else if (input.provider === "gemini") {
      // Gemini format: add system + normalize contents + extract response
      const systemMessage: Message[] = input.systemInstruction
        ? [{ role: "system", content: input.systemInstruction }]
        : [];
      const inputMessages = normalizeGeminiContents(input.contents);
      const responseMessages = extractGeminiMessages(input.response);
      normalizedMessages = [...systemMessage, ...inputMessages, ...responseMessages];
    } else {
      throw new Error("Invalid track input: must be Message[] or provider-specific input");
    }

    await this.makeRequest<TrackRequest, TrackResponse>("/insert_runs", "POST", {
      id,
      messages: normalizedMessages,
      sessionId: options.sessionId,
      timestamp: new Date().toISOString(),
    });
  }
}

// Factory function for easier initialization
export function createHoneClient(config: HoneConfig): HoneClient {
  return new Hone(config);
}
