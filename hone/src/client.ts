/**
 * Hone Client Module
 *
 * Provides the main Client class for interacting with the Hone API.
 * This extends LangSmith's Client with Hone-specific defaults.
 */

import { Client as LangSmithClient, type ClientConfig } from "langsmith";
import { getApiUrl, getApiKey } from "./patch";

/**
 * Hone Client configuration options.
 */
export interface HoneClientConfig extends Partial<ClientConfig> {
  /** Hone API URL. Defaults to HONE_ENDPOINT env var or https://api.honeagents.ai */
  apiUrl?: string;
  /** API key. Defaults to HONE_API_KEY env var */
  apiKey?: string;
}

/**
 * Hone API Client.
 *
 * A client for tracking LLM calls and managing evaluations with Hone.
 * This extends LangSmith's Client with Hone-specific defaults.
 *
 * @example
 * ```typescript
 * import { Client } from "@hone/sdk";
 *
 * // Using environment variables
 * // export HONE_API_KEY=hone_xxx
 * const client = new Client();
 *
 * // Or explicit configuration
 * const client = new Client({
 *   apiKey: "hone_xxx",
 *   apiUrl: "https://api.honeagents.ai"
 * });
 * ```
 */
export class Client extends LangSmithClient {
  constructor(config: HoneClientConfig = {}) {
    // Get API URL with Hone defaults
    const apiUrl = getApiUrl(config.apiUrl);

    // Get API key with Hone defaults
    const apiKey = getApiKey(config.apiKey);

    // Call parent constructor with Hone configuration
    super({
      ...config,
      apiUrl,
      apiKey,
    });
  }
}

// Re-export useful types from langsmith
export type { ClientConfig } from "langsmith";
