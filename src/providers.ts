/**
 * Re-export providers from @hone/shared for SDK users.
 *
 * @example
 * ```typescript
 * import { AIProvider } from "hone-sdk";
 *
 * const agent = await hone.agent("my-agent", {
 *   provider: AIProvider.OpenAI,
 *   model: "gpt-4o",
 *   defaultPrompt: "You are a helpful assistant.",
 * });
 * ```
 */
export {
  AIProvider,
  AI_PROVIDER_VALUES,
  isValidProvider,
  getProviderDisplayName,
} from "@hone/shared";

export type { AIProviderValue } from "@hone/shared";
