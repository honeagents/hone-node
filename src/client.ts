// client.ts
import {
  GetAgentOptions,
  GetToolOptions,
  HoneClient,
  HoneConfig,
  Message,
  AgentRequest,
  AgentResponse,
  AgentResult,
  ToolResult,
  EntityRequest,
  EntityResponse,
  TrackConversationOptions,
  TrackRequest,
  TrackResponse,
} from "./types";
import {
  evaluateAgent,
  evaluateEntity,
  formatAgentRequest,
  formatEntityRequest,
  getAgentNode,
  getToolNode,
  updateAgentNodes,
  updateEntityNodes,
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

  async agent(id: string, options: GetAgentOptions): Promise<AgentResult> {
    const node = getAgentNode(id, options);
    try {
      const formattedRequest = formatAgentRequest(node);
      const newAgentMap = await this.makeRequest<
        AgentRequest,
        AgentResponse
      >("/sync_agents", "POST", formattedRequest);

      const updatedAgentNode = updateAgentNodes(node, (agentNode) => {
        const responseItem = newAgentMap[agentNode.id];
        return {
          ...agentNode,
          prompt: responseItem?.prompt || agentNode.prompt,
          // Update hyperparameters from API response (if present)
          model: responseItem?.model ?? agentNode.model,
          temperature: responseItem?.temperature ?? agentNode.temperature,
          maxTokens: responseItem?.maxTokens ?? agentNode.maxTokens,
          topP: responseItem?.topP ?? agentNode.topP,
          frequencyPenalty: responseItem?.frequencyPenalty ?? agentNode.frequencyPenalty,
          presencePenalty: responseItem?.presencePenalty ?? agentNode.presencePenalty,
          stopSequences: responseItem?.stopSequences ?? agentNode.stopSequences,
        };
      });

      // Get the root agent's hyperparameters from the response
      const rootResponse = newAgentMap[id];

      // Params are inserted client-side for flexibility and security
      return {
        systemPrompt: evaluateAgent(updatedAgentNode),
        model: rootResponse?.model ?? options.model,
        provider: rootResponse?.provider ?? options.provider,
        temperature: rootResponse?.temperature ?? options.temperature ?? null,
        maxTokens: rootResponse?.maxTokens ?? options.maxTokens ?? null,
        topP: rootResponse?.topP ?? options.topP ?? null,
        frequencyPenalty:
          rootResponse?.frequencyPenalty ?? options.frequencyPenalty ?? null,
        presencePenalty:
          rootResponse?.presencePenalty ?? options.presencePenalty ?? null,
        stopSequences: rootResponse?.stopSequences ?? options.stopSequences ?? [],
        tools: rootResponse?.tools ?? options.tools ?? [],
      };
    } catch (error) {
      console.log("Error fetching agent, using fallback:", error);
      // Fallback: use local defaults
      return {
        systemPrompt: evaluateAgent(node),
        model: options.model,
        provider: options.provider,
        temperature: options.temperature ?? null,
        maxTokens: options.maxTokens ?? null,
        topP: options.topP ?? null,
        frequencyPenalty: options.frequencyPenalty ?? null,
        presencePenalty: options.presencePenalty ?? null,
        stopSequences: options.stopSequences ?? [],
        tools: options.tools ?? [],
      };
    }
  }


  async tool(id: string, options: GetToolOptions): Promise<ToolResult> {
    const node = getToolNode(id, options);
    try {
      const formattedRequest = formatEntityRequest(node);
      const entityResponseMap = await this.makeRequest<
        EntityRequest,
        EntityResponse
      >("/sync_entities", "POST", formattedRequest);

      const updatedToolNode = updateEntityNodes(node, (entityNode) => {
        const responseItem = entityResponseMap[entityNode.id];
        return {
          ...entityNode,
          prompt: responseItem?.prompt || entityNode.prompt,
        };
      });

      // Params are inserted client-side for flexibility and security
      return {
        prompt: evaluateEntity(updatedToolNode),
      };
    } catch (error) {
      console.log("Error fetching tool, using fallback:", error);
      // Fallback: use local defaults
      return {
        prompt: evaluateEntity(node),
      };
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
