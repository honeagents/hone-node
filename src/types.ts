// types.ts - Hone SDK types
export type HoneConfig = {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
};

export type ParamsValue = string | GetAgentOptions;
export type Params = Record<string, ParamsValue>;

export type HoneAgent = (
  id: string,
  options: GetAgentOptions,
) => Promise<string>;

export type HoneTrack = (
  id: string,
  messages: Message[],
  options: TrackConversationOptions,
) => Promise<void>;

export type HoneClient = {
  /**
   * Fetches and evaluates an agent by its ID with the given options.
   * @param id The unique identifier for the agent.
   * @param options Options for fetching and evaluating the agent.
   * @returns A Promise that resolves to the evaluated prompt string.
   */
  agent: HoneAgent;
  /**
   * Adds messages to track a conversation under the given ID.
   * @param id The unique identifier for the conversation to track.
   * @param messages An array of Message objects representing the conversation.
   * @param options Optional TrackConversationOptions such as sessionId.
   */
  track: HoneTrack;
};

/**
 * Hyperparameters for LLM configuration.
 */
export type Hyperparameters = {
  /** LLM model identifier (e.g., "gpt-4", "claude-3-opus") */
  model?: string;
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
};

export type GetAgentOptions = Hyperparameters & {
  /**
   * The major version of the agent. SDK controls this value.
   * When majorVersion changes, minorVersion resets to 0.
   * If not specified, defaults to 1.
   */
  majorVersion?: number;
  /** Optional name for the agent for easier identification.
   *  Will fallback to id if not provided.
   */
  name?: string;
  /**
   * Parameters to substitute into the prompt. You can also nest agent calls here.
   */
  params?: Params;
  /**
   * The default prompt to use if none is found in the database.
   * The use of variables should be in the form `{{variableName}}`.
   *
   * @example
   * ```typescript
   * agent("greeting", {
   *   params: { userName: "Alice" },
   *   defaultPrompt: "Hello, {{userName}}! Welcome to our service.",
   * })
   * ```
   */
  defaultPrompt: string;
};

export type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type TrackConversationOptions = {
  sessionId: string;
};

export type SimpleParams = Record<string, string>;

export type AgentNode = Hyperparameters & {
  id: string;
  name?: string;
  majorVersion?: number;
  params: SimpleParams;
  prompt: string;
  children: AgentNode[];
};

/**
 * The request payload sent to the /sync_agents endpoint.
 */
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

/**
 * The response received from the /sync_agents endpoint.
 * @key The agent ID
 * @value The newest prompt string
 */
export type AgentResponse = Record<string, { prompt: string }>;

export type TrackRequest = {
  id: string;
  messages: Message[];
  sessionId: string;
  timestamp: string;
};

export type TrackResponse = void;

// ============================================================================
// Backwards Compatibility Aliases (deprecated)
// ============================================================================

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
