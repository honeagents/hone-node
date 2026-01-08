/**
 * Hone SDK - AI Experience Engineering Platform
 *
 * Hone is an SDK-first evaluation platform that automatically tracks LLM calls,
 * generates test cases from production failures, and helps improve prompts.
 *
 * This SDK wraps the LangSmith SDK to redirect all data to Hone's backend
 * while maintaining full compatibility with LangSmith's battle-tested APIs.
 *
 * @example Quick Start
 * ```typescript
 * import { traceable, Client } from "@hone/sdk";
 *
 * // Set your API key
 * process.env.HONE_API_KEY = "hone_xxx";
 *
 * // Track functions with the decorator
 * const myAgent = traceable(async (query: string) => {
 *   // Your LLM call here
 *   return "response";
 * }, { name: "my-agent" });
 *
 * // Or use the client directly
 * const client = new Client();
 * ```
 *
 * @example Environment Variables
 * - HONE_API_KEY: Your Hone API key
 * - HONE_ENDPOINT: API endpoint (default: https://api.honeagents.ai)
 * - HONE_PROJECT: Project name for organizing traces
 * - HONE_TRACING: Enable/disable tracing ("true" or "false")
 *
 * @example Migration from LangSmith
 * Simply change your imports from `langsmith` to `@hone/sdk`.
 * LANGSMITH_* environment variables are supported for backward compatibility.
 *
 * @packageDocumentation
 */

// Version
export const VERSION = "0.1.0";

// Configuration utilities
export {
  getApiUrl,
  getApiKey,
  getProjectName,
  isTracingEnabled,
  getEnvVar,
} from "./patch";

// Client
export { Client, type HoneClientConfig } from "./client";

// Re-export ClientConfig from langsmith
export type { ClientConfig } from "langsmith";

// Tracing
export {
  traceable,
  getCurrentRunTree,
  isTraceableFunction,
  RunTree,
  type RunTreeConfig,
  type TraceableFunction,
  type HoneTraceableConfig,
} from "./traceable";

// Schemas
export type {
  Run,
  Dataset,
  Example,
  Feedback,
  TracerSession,
  KVMap,
  RunCreate,
  RunUpdate,
  FeedbackCreate,
  ExampleCreate,
  ExampleUpdate,
} from "./schemas";

// Wrappers (re-export for convenience)
export { wrapOpenAI, wrapAnthropic } from "./wrappers";
