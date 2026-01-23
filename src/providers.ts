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
  // Major LLM Providers
  // =============================================================================

  /** OpenAI - GPT models (gpt-4o, gpt-4, gpt-3.5-turbo, etc.) */
  OpenAI = "openai",

  /** Anthropic - Claude models (claude-3-opus, claude-3-sonnet, claude-3-haiku, etc.) */
  Anthropic = "anthropic",

  /** Google Generative AI - Gemini models (gemini-pro, gemini-1.5-pro, etc.) */
  Google = "google",

  /** Google Vertex AI - Enterprise Gemini models */
  GoogleVertex = "google-vertex",

  /** Azure OpenAI Service - Azure-hosted OpenAI models */
  Azure = "azure",

  // =============================================================================
  // Specialized Providers
  // =============================================================================

  /** xAI - Grok models */
  XAI = "xai",

  /** Mistral AI - Mistral models (mistral-large, mistral-medium, etc.) */
  Mistral = "mistral",

  /** Cohere - Command models */
  Cohere = "cohere",

  // =============================================================================
  // Inference Providers
  // =============================================================================

  /** Groq - Fast inference for open models */
  Groq = "groq",

  /** Together.ai - Open model hosting */
  TogetherAI = "togetherai",

  /** Fireworks - Fast inference platform */
  Fireworks = "fireworks",

  /** DeepInfra - Model inference */
  DeepInfra = "deepinfra",

  /** DeepSeek - DeepSeek models */
  DeepSeek = "deepseek",

  /** Cerebras - Fast inference */
  Cerebras = "cerebras",

  /** Perplexity - Perplexity models with web search */
  Perplexity = "perplexity",

  // =============================================================================
  // Cloud Providers
  // =============================================================================

  /** Amazon Bedrock - AWS-hosted models */
  AmazonBedrock = "amazon-bedrock",

  /** Baseten - Model hosting platform */
  Baseten = "baseten",
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
  "google-vertex": "Google Vertex AI",
  azure: "Azure OpenAI",
  xai: "xAI",
  mistral: "Mistral AI",
  cohere: "Cohere",
  groq: "Groq",
  togetherai: "Together.ai",
  fireworks: "Fireworks",
  deepinfra: "DeepInfra",
  deepseek: "DeepSeek",
  cerebras: "Cerebras",
  perplexity: "Perplexity",
  "amazon-bedrock": "Amazon Bedrock",
  baseten: "Baseten",
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
