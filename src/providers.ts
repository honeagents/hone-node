/**
 * AI Provider definitions compatible with Vercel AI SDK.
 *
 * This module provides type-safe provider identifiers that align with
 * the Vercel AI SDK's official provider packages (@ai-sdk/*).
 *
 * @see https://ai-sdk.dev/providers/ai-sdk-providers
 *
 * @example
 * ```typescript
 * import { AIProvider } from "@honeagents/hone";
 *
 * const agent = await hone.agent("my-agent", {
 *   provider: AIProvider.OpenAI,
 *   model: "gpt-4o",
 *   defaultPrompt: "You are a helpful assistant.",
 * });
 * ```
 */

/**
 * Supported AI providers from the Vercel AI SDK ecosystem.
 *
 * These correspond to the official @ai-sdk/* provider packages.
 * Use these identifiers when specifying the `provider` field in agent options.
 */
export enum AIProvider {
  // =============================================================================
  // Supported Providers
  // =============================================================================

  /** OpenAI - GPT models (gpt-4o, gpt-4o-mini, gpt-4-turbo, etc.) */
  OpenAI = "openai",

  /** Anthropic - Claude models (claude-3-opus, claude-3-sonnet, claude-3-haiku, etc.) */
  Anthropic = "anthropic",

  /** Google Generative AI - Gemini models (gemini-2.0-flash, gemini-1.5-pro, etc.) */
  Google = "google",

  // =============================================================================
  // Future Providers
  // =============================================================================
  // Add new providers here as needed
}

/**
 * Type representing all valid provider string values.
 * Use this when you need a union type of provider strings.
 */
export type AIProviderValue = `${AIProvider}`;

/**
 * Array of all provider values for runtime validation.
 */
export const AI_PROVIDER_VALUES: readonly AIProviderValue[] = Object.values(
  AIProvider
) as AIProviderValue[];

/**
 * Check if a string is a valid AI provider.
 *
 * @param value - The string to check
 * @returns True if the value is a valid AIProvider
 *
 * @example
 * ```typescript
 * if (isValidProvider(userInput)) {
 *   // userInput is typed as AIProviderValue
 * }
 * ```
 */
export function isValidProvider(value: string): value is AIProviderValue {
  return AI_PROVIDER_VALUES.includes(value as AIProviderValue);
}

/**
 * Display name mapping for providers.
 */
const PROVIDER_DISPLAY_NAMES: Record<AIProviderValue, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google AI",
};

/**
 * Get the display name for a provider.
 *
 * @param provider - The provider identifier
 * @returns Human-readable provider name
 *
 * @example
 * ```typescript
 * getProviderDisplayName("openai") // "OpenAI"
 * getProviderDisplayName("amazon-bedrock") // "Amazon Bedrock"
 * ```
 */
export function getProviderDisplayName(
  provider: AIProviderValue | string
): string {
  return PROVIDER_DISPLAY_NAMES[provider as AIProviderValue] || provider;
}
