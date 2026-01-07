/**
 * Hone SDK - AI Experience Engineering Platform
 *
 * Hone is an SDK-first evaluation platform that automatically tracks LLM calls,
 * generates test cases from production failures, and helps improve prompts.
 *
 * This SDK wraps the LangSmith SDK to redirect all data to Hone's backend
 * while maintaining full compatibility with LangSmith's battle-tested APIs.
 *
 * @example
 * ```typescript
 * import { traceable, Client } from "hone-sdk";
 *
 * // Set your API key via environment variable
 * // export HONE_API_KEY=hone_xxx
 * // export HONE_ENDPOINT=https://api.honeagents.ai
 *
 * // Track functions with the traceable wrapper
 * const myAgent = traceable(
 *   async (query: string) => {
 *     // Your LLM call here
 *     return "response";
 *   },
 *   { name: "my-agent" }
 * );
 *
 * // Or use the client directly
 * const client = new Client();
 * ```
 *
 * @packageDocumentation
 */

import { initializeEnvironment } from "./env";

// Initialize environment variables on import
// This syncs HONE_* env vars to LANGSMITH_* so wrappers work correctly
initializeEnvironment();

export const VERSION = "0.1.0";

// Export client
export { Client } from "./client";
export type { HoneClientConfig } from "./client";

// Export traceable decorator and utilities
export {
  traceable,
  getCurrentRunTree,
  isTraceableFunction,
  withRunTree,
  ROOT,
} from "./traceable";
export type { RunTreeLike, TraceableFunction } from "./traceable";

// Export RunTree for manual trace management
export { RunTree } from "./run_trees";
export type { RunTreeConfig } from "./run_trees";

// Export schema types
export type {
  Run,
  RunCreate,
  RunUpdate,
  Feedback,
  FeedbackCreate,
  FeedbackBase,
  FeedbackSourceBase,
  Dataset,
  BaseDataset,
  Example,
  ExampleCreate,
  TracerSession,
  DataType,
  RunType,
  KVMap,
} from "./schemas";

// Export environment utilities
export {
  getEnvVar,
  getApiUrl,
  getApiKey,
  getProjectName,
  isTracingEnabled,
} from "./env";

// Export configuration
export {
  HONE_DEFAULT_ENDPOINT,
  HONE_ENV_PREFIX,
  ENV_NAMESPACES,
} from "./config";

// Export wrappers
export { wrapOpenAI } from "./wrappers";
