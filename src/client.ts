// client.ts
import {
  GetAgentOptions,
  HoneClient,
  HoneConfig,
  Message,
  AgentRequest,
  AgentResponse,
  TrackConversationOptions,
  TrackRequest,
  TrackResponse,
} from "./types";
import {
  evaluateAgent,
  formatAgentRequest,
  getAgentNode,
  updateAgentNodes,
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

  async agent(id: string, options: GetAgentOptions): Promise<string> {
    const node = getAgentNode(id, options);
    try {
      const formattedRequest = formatAgentRequest(node);
      const newAgentMap = await this.makeRequest<
        AgentRequest,
        AgentResponse
      >("/sync_agents", "POST", formattedRequest);

      const updatedAgentNode = updateAgentNodes(node, (agentNode) => {
        return {
          ...agentNode,
          prompt: newAgentMap[agentNode.id]?.prompt || agentNode.prompt,
        };
      });
      // Params are inserted client-side for flexibility and security
      return evaluateAgent(updatedAgentNode);
    } catch (error) {
      console.log("Error fetching agent, using fallback:", error);
      return evaluateAgent(node);
    }
  }

  /**
   * @deprecated Use agent() instead
   */
  async prompt(id: string, options: GetAgentOptions): Promise<string> {
    return this.agent(id, options);
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
