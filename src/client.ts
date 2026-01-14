// client.ts - Create a new file
import {
  GetPromptOptions,
  HoneClient,
  HoneConfig,
  Message,
  PromptRequest,
  PromptResponse,
  TrackConversationOptions,
  TrackRequest,
  TrackResponse,
} from "./types";
import {
  evaluatePrompt,
  formatPromptRequest,
  getPromptNode,
  updatePromptNodes,
} from "./prompt";

const DEFAULT_BASE_URL = "https://honeagents.ai/api";
const DEFAULT_TIMEOUT = 10000;
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

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
          apikey: SUPABASE_ANON_KEY, // Supabase RPC requires lowercase "apikey"
          "x-api-key": this.apiKey, // Your RPC function reads this for project auth
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
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
      >("/sync_prompts", "POST", formattedRequest);

      const updatedPromptNode = updatePromptNodes(node, (promptNode) => {
        return {
          ...promptNode,
          prompt: newPromptMap[promptNode.id]?.prompt || promptNode.prompt,
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
    id: string,
    messages: Message[],
    options: TrackConversationOptions,
  ): Promise<void> {
    await this.makeRequest<TrackRequest, TrackResponse>("/insert_runs", "POST", {
      id,
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
