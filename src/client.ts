// client.ts - Create a new file
import {
  GetPromptOptions,
  HoneClient,
  HoneConfig,
  Message,
  PromptRequest,
  PromptResponse,
  TrackConversationOptions,
} from "./types";
import {
  evaluatePrompt,
  formatPromptRequest,
  getPromptNode,
  updatePromptNodes,
} from "./utils";

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
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "User-Agent": "hone-sdk-typescript/0.1.0",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(
          `Hone API error (${response.status}): ${errorData.message || response.statusText}`,
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

  async prompt(id: string, options: GetPromptOptions): Promise<string> {
    const node = getPromptNode(id, options);
    try {
      const formattedRequest = formatPromptRequest(node);
      const newPromptMap = await this.makeRequest<
        PromptRequest,
        PromptResponse
      >("/prompts", "POST", formattedRequest);

      const updatedPromptNode = updatePromptNodes(node, (promptNode) => {
        return {
          ...promptNode,
          prompt: newPromptMap[promptNode.id] || promptNode.prompt,
        };
      });
      // Params are inserted client-side for flexibility and security
      return evaluatePrompt(updatedPromptNode);
    } catch (error) {
      console.log("Error fetching prompt, using fallback:", error);
      return evaluatePrompt(node);
    }
  }

  async track(
    name: string,
    messages: Message[],
    options: TrackConversationOptions = {},
  ): Promise<void> {
    await this.makeRequest("/track", "POST", {
      name,
      messages,
      sessionId: options.sessionId,
      timestamp: new Date().toISOString(),
    });
  }
}

// Factory function for easier initialization
export function createHoneClient(config: HoneConfig): HoneClient {
  return new Hone(config);
}
