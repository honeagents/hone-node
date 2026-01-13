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
  name: string,
  messages: Message[],
  options?: TrackConversationOptions,
) => Promise<void>;

export type HoneClient = {
  prompt: HonePrompt;
  track: HoneTrack;
};

export type GetPromptOptions = {
  version?: string;
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
  rootId: string;
  map: Record<string, PromptRequestItem>;
};

/**
 * The response received from the /prompts endpoint.
 * @key The prompt ID
 * @value The newest prompt string
 */
export type PromptResponse = Record<string, string>;
