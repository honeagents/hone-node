// types.ts - Hone SDK types

import type { AIProviderValue } from "./providers.js";

export type HoneConfig = {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
};

// =============================================================================
// Entity Types
// =============================================================================

/**
 * Supported entity types in the Hone system.
 */
export type EntityType = "agent" | "tool" | "prompt";

// =============================================================================
// Params Types
// =============================================================================


export type ParamsValue = string | GetTextPromptOptions
export type Params = Record<string, ParamsValue>;
export type SimpleParams = Record<string, string>;

// =============================================================================
// Agent Types
// =============================================================================

/**
 * Hyperparameters for LLM configuration.
 * Used by agents to configure LLM behavior.
 */
export type Hyperparameters = {
  /** LLM model identifier (e.g., "gpt-4", "claude-3-opus") - REQUIRED for agents */
  model?: string;
  /**
   * LLM provider identifier. Use AIProvider enum for type safety.
   * @example AIProvider.OpenAI, AIProvider.Anthropic, "openai", "anthropic"
   */
  provider?: AIProviderValue | (string & Record<string, never>);
  /** Sampling temperature (0.00 to 2.00) */
  temperature?: number;
  /** Maximum output tokens */
  maxTokens?: number;
  /** Nucleus sampling parameter (0.00 to 1.00) */
  topP?: number;
  /** Repetition penalty (-2.00 to 2.00) */
  frequencyPenalty?: number;
  /** Topic diversity penalty (-2.00 to 2.00) */
  presencePenalty?: number;
  /** Array of stop tokens */
  stopSequences?: string[];
  /** Array of tool IDs this agent can use */
  tools?: string[];
};

/**
 * Required hyperparameters for agents.
 * Model and provider are mandatory.
 */
export type RequiredAgentHyperparameters = Required<
  Pick<Hyperparameters, "model" | "provider">
> &
  Omit<Hyperparameters, "model" | "provider">;

/**
 * Options for fetching an agent.
 * Model and provider are REQUIRED.
 *
 * @typeParam TExtra - Type for custom extra data that will be stored and returned
 */
export type GetAgentOptions<TExtra extends Record<string, unknown> = Record<string, unknown>> = RequiredAgentHyperparameters & {
  /**
   * The major version of the agent. SDK controls this value.
   * When majorVersion changes, minorVersion resets to 0.
   * If not specified, defaults to 1.
   */
  majorVersion?: number;
  /**
   * Optional name for the agent for easier identification.
   * Will fallback to id if not provided.
   */
  name?: string;
  /**
   * Parameters to substitute into the prompt. You can also nest agent/tool calls here.
   */
  params?: Params;
  /**
   * The default prompt to use if none is found in the database.
   * The use of variables should be in the form `{{variableName}}`.
   *
   * @example
   * ```typescript
   * agent("greeting", {
   *   model: "gpt-4",
   *   provider: "openai",
   *   params: { userName: "Alice" },
   *   defaultPrompt: "Hello, {{userName}}! Welcome to our service.",
   * })
   * ```
   */
  defaultPrompt: string;
  /**
   * Custom extra data to store with the agent.
   * This data is stored in the database and returned in the AgentResult.
   *
   * @example
   * ```typescript
   * agent<{ customField: string }>("my-agent", {
   *   model: "gpt-4",
   *   provider: "openai",
   *   defaultPrompt: "...",
   *   extra: { customField: "my-value" },
   * })
   * ```
   */
  extra?: TExtra;
};

/**
 * Base result returned by hone.agent() without extra data.
 * Contains both the evaluated system prompt and hyperparameters.
 */
export type BaseAgentResult = {
  /** The fully evaluated system prompt with all parameters substituted */
  systemPrompt: string;
  /** LLM model identifier (e.g., "gpt-4", "claude-3-opus") */
  model: string;
  /** LLM provider (e.g., "openai", "anthropic") */
  provider: string;
  /** Sampling temperature (0.00 to 2.00) */
  temperature: number | null;
  /** Maximum output tokens */
  maxTokens: number | null;
  /** Nucleus sampling parameter (0.00 to 1.00) */
  topP: number | null;
  /** Repetition penalty (-2.00 to 2.00) */
  frequencyPenalty: number | null;
  /** Topic diversity penalty (-2.00 to 2.00) */
  presencePenalty: number | null;
  /** Array of stop tokens */
  stopSequences: string[];
  /** Array of allowed tool IDs */
  tools: string[];
};

/**
 * The result returned by hone.agent()
 * Contains the evaluated system prompt, hyperparameters, and any extra data.
 *
 * @typeParam TExtra - Type for custom extra data that was stored with the agent
 */
export type AgentResult<TExtra extends Record<string, unknown> = Record<string, unknown>> =
  BaseAgentResult & TExtra;

export type HoneAgent = <TExtra extends Record<string, unknown> = Record<string, unknown>>(
  id: string,
  options: GetAgentOptions<TExtra>
) => Promise<AgentResult<TExtra>>;

// =============================================================================
// Tool Types
// =============================================================================

/**
 * Options for fetching a tool.
 * Tools don't have hyperparameters - they're just versioned text templates.
 */
export type GetToolOptions = {
  /**
   * The major version of the tool. SDK controls this value.
   * When majorVersion changes, minorVersion resets to 0.
   * If not specified, defaults to 1.
   */
  majorVersion?: number;
  /**
   * Optional name for the tool for easier identification.
   * Will fallback to id if not provided.
   */
  name?: string;
  /**
   * Parameters to substitute into the prompt. You can also nest agent/tool calls here.
   */
  params?: Params;
  /**
   * The default prompt/description to use if none is found in the database.
   * The use of variables should be in the form `{{variableName}}`.
   *
   * @example
   * ```typescript
   * tool("search", {
   *   params: { query: "weather" },
   *   defaultPrompt: "Search the web for: {{query}}",
   * })
   * ```
   */
  defaultPrompt: string;
};

/**
 * The result returned by hone.tool()
 * Contains the evaluated prompt with parameters substituted.
 */
export type ToolResult = {
  /** The fully evaluated prompt with all parameters substituted */
  prompt: string;
};

export type HoneTool = (
  id: string,
  options: GetToolOptions
) => Promise<ToolResult>;

// =============================================================================
// Text Prompt Types
// =============================================================================

/**
 * Options for fetching a text prompt.
 * Text prompts are simple versioned text templates with no hyperparameters.
 * They can be nested inside agents, tools, or other prompts.
 */
export type GetTextPromptOptions = {
  /**
   * The major version of the prompt. SDK controls this value.
   * When majorVersion changes, minorVersion resets to 0.
   * If not specified, defaults to 1.
   */
  majorVersion?: number;
  /**
   * Optional name for the prompt for easier identification.
   * Will fallback to id if not provided.
   */
  name?: string;
  /**
   * Parameters to substitute into the prompt. You can also nest other prompts here.
   */
  params?: Params;
  /**
   * The default text to use if none is found in the database.
   * The use of variables should be in the form `{{variableName}}`.
   *
   * @example
   * ```typescript
   * prompt("tone-guidelines", {
   *   defaultPrompt: "Always be friendly and professional.",
   * })
   * ```
   */
  defaultPrompt: string;
};

/**
 * The result returned by hone.prompt()
 * Contains the evaluated text with parameters substituted.
 */
export type TextPromptResult = {
  /** The fully evaluated text with all parameters substituted */
  text: string;
};

export type HoneTextPrompt = (
  id: string,
  options: GetTextPromptOptions
) => Promise<TextPromptResult>;

// =============================================================================
// Tracking Types
// =============================================================================

/**
 * Represents a tool call made by the assistant.
 * Compatible with OpenAI's function calling format.
 */
export type ToolCall = {
  /** Unique identifier for this tool call */
  id: string;
  /** Name of the tool/function being called */
  name: string;
  /** JSON string of the arguments to pass to the tool */
  arguments: string;
};

export type Message = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  /** Tool calls requested by the assistant (present when role is "assistant") */
  tool_calls?: ToolCall[];
  /** ID of the tool call this message is responding to (present when role is "tool") */
  tool_call_id?: string;
};

export type TrackConversationOptions = {
  sessionId: string;
};

export type HoneTrack = (
  id: string,
  messages: Message[],
  options: TrackConversationOptions
) => Promise<void>;

export type TrackRequest = {
  id: string;
  messages: Message[];
  sessionId: string;
  timestamp: string;
};

export type TrackResponse = void;

// =============================================================================
// Client Interface
// =============================================================================

export type HoneClient = {
  /**
   * Fetches and evaluates an agent by its ID with the given options.
   * @param id The unique identifier for the agent.
   * @param options Options for fetching and evaluating the agent. Model and provider are required.
   * @returns A Promise that resolves to an AgentResult containing systemPrompt and hyperparameters.
   */
  agent: HoneAgent;
  /**
   * Fetches and evaluates a tool by its ID with the given options.
   * @param id The unique identifier for the tool.
   * @param options Options for fetching and evaluating the tool.
   * @returns A Promise that resolves to a ToolResult containing the evaluated prompt.
   */
  tool: HoneTool;
  /**
   * Fetches and evaluates a text prompt by its ID with the given options.
   * @param id The unique identifier for the prompt.
   * @param options Options for fetching and evaluating the prompt.
   * @returns A Promise that resolves to a TextPromptResult containing the evaluated text.
   */
  prompt: HoneTextPrompt;
  /**
   * Adds messages to track a conversation under the given ID.
   * @param id The unique identifier for the conversation to track.
   * @param messages An array of Message objects representing the conversation.
   * @param options Optional TrackConversationOptions such as sessionId.
   */
  track: HoneTrack;
};

// =============================================================================
// Internal Node Types
// =============================================================================

/**
 * Internal representation of an entity node in the tree.
 */
export type EntityNode = Hyperparameters & {
  id: string;
  type: EntityType;
  name?: string;
  majorVersion?: number;
  params: SimpleParams;
  prompt: string;
  children: EntityNode[];
};

/**
 * Agent node is an EntityNode with type="agent"
 */
export type AgentNode = EntityNode & { type: "agent" };

/**
 * Tool node is an EntityNode with type="tool"
 */
export type ToolNode = EntityNode & { type: "tool" };

/**
 * Text prompt node is an EntityNode with type="prompt"
 */
export type TextPromptNode = EntityNode & { type: "prompt" };

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * The request item sent to the /sync_entities endpoint.
 */
export type EntityRequestItem = Omit<EntityNode, "children" | "params"> & {
  paramKeys: string[];
  childrenIds: string[];
  childrenTypes: EntityType[];
};

/**
 * The request payload sent to the /sync_entities endpoint.
 */
export type EntityRequest = {
  entities: {
    rootId: string;
    rootType: EntityType;
    map: Record<string, EntityRequestItem>;
  };
};

/**
 * Single entity data from the /sync_entities response.
 */
export type EntityResponseItem = {
  prompt: string;
  type: EntityType;
  // Agent-specific fields (null for tools)
  model: string | null;
  provider: string | null;
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
  frequencyPenalty: number | null;
  presencePenalty: number | null;
  stopSequences: string[];
  tools: string[];
  // Custom extra data (for agents)
  extra?: Record<string, unknown>;
};

/**
 * The response received from the /sync_entities endpoint.
 * @key The entity ID
 * @value The entity data including prompt and (for agents) hyperparameters
 */
export type EntityResponse = Record<string, EntityResponseItem>;

// =============================================================================
// Backwards Compatibility Aliases
// =============================================================================

// Keep old request/response types for sync_agents endpoint compatibility
export type AgentRequestItem = Omit<AgentNode, "children" | "params"> & {
  paramKeys: string[];
  childrenIds: string[];
};

export type AgentRequest = {
  agents: {
    rootId: string;
    map: Record<string, AgentRequestItem>;
  };
};

export type AgentResponseItem = {
  prompt: string;
  model: string | null;
  provider: string | null;
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
  frequencyPenalty: number | null;
  presencePenalty: number | null;
  stopSequences: string[];
  tools: string[];
};

export type AgentResponse = Record<string, AgentResponseItem>;

// Deprecated aliases from prompt era
/** @deprecated Use GetAgentOptions instead */
export type GetPromptOptions = GetAgentOptions;

/** @deprecated Use AgentNode instead */
export type PromptNode = AgentNode;

/** @deprecated Use AgentRequestItem instead */
export type PromptRequestItem = AgentRequestItem;

/** @deprecated Use AgentRequest instead */
export type PromptRequest = AgentRequest;

/** @deprecated Use AgentResponse instead */
export type PromptResponse = AgentResponse;

/** @deprecated Use HoneAgent instead */
export type HonePrompt = HoneAgent;
