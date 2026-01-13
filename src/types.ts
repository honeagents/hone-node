// types.ts - Add these types
export type HoneConfig = {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
};

export type ParamsValue = string | GetPromptOptions;
export type Params = Record<string, ParamsValue>;

export type HonePrompt = (
  id: string,
  options: GetPromptOptions,
) => Promise<string>;

export type HoneTrack = (
  id: string,
  messages: Message[],
  options?: TrackConversationOptions,
) => Promise<void>;

export type HoneClient = {
  /**
   * Fetches and evaluates a prompt by its ID with the given options.
   * @param id The unique identifier for the prompt.
   * @param options Options for fetching and evaluating the prompt.
   * @returns A Promise that resolves to the evaluated prompt string.
   */
  prompt: HonePrompt;
  /**
   * Adds messages to track a conversation under the given ID.
   * @param id The unique identifier for the conversation to track.
   * @param messages An array of Message objects representing the conversation.
   * @param options Optional TrackConversationOptions such as sessionId.
   */
  track: HoneTrack;
};

export type GetPromptOptions = {
  /**
   * The version of the prompt to retrieve. If not specified, the latest version is used.
   * @note `params` and `defaultPrompt` are not updated remotely without version changes.
   */
  version?: string;
  /** Optional name for the prompt for easier identification.
   *  Will fallback to id if not provided.
   */
  name?: string;
  /**
   * Parameters to substitute into the prompt. You can also nest prompt calls here.
   */
  params?: Params;
  /**
   * The default prompt to use if none is found in the database.
   * The use of variables should be in the form `{{variableName}}`.
   *
   * @example
   * ```typescript
   * prompt("greeting", {
   *   params: { userName: "Alice" },
   *   defaultPrompt: "Hello, {{userName}}! Welcome to our service.",
   */
  defaultPrompt: string;
};

export type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type TrackConversationOptions = {
  sessionId?: string;
};

export type SimpleParams = Record<string, string>;

export type PromptNode = {
  id: string;
  name?: string;
  version?: string;
  params: SimpleParams;
  prompt: string;
  children: PromptNode[];
};

/**
 * The request payload sent to the /prompts endpoint.
 *
 * @template T The type of parameter keys in the PromptNode.
 */
export type PromptRequestItem = Omit<PromptNode, "children" | "params"> & {
  paramKeys: string[];
  childrenIds: string[];
};

export type PromptRequest = {
  prompts: {
    rootId: string;
    map: Record<string, PromptRequestItem>;
  };
};

/**
 * The response received from the /prompts endpoint.
 * @key The prompt ID
 * @value The newest prompt string
 */
export type PromptResponse = Record<string, { prompt: string }>;

export type TrackRequest = {
  id: string;
  messages: Message[];
  sessionId?: string;
  timestamp: string;
};

export type TrackResponse = void;
