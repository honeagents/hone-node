/**
 * Hone SDK - Agent Observability & Evaluation
 *
 * Simple SDK for tracking AI agents and running evaluations.
 *
 * @example Quick Start
 * ```typescript
 * import { hone } from "hone-sdk";
 * import OpenAI from "openai";
 *
 * // Set environment variables:
 * // HONE_API_KEY=hone_xxx
 * // HONE_PROJECT=my-project
 *
 * // Wrap your OpenAI client
 * const openai = hone(new OpenAI());
 *
 * // Define an agent
 * const supportAgent = hone.agent(async (query: string) => {
 *   return await openai.chat.completions.create({
 *     messages: [
 *       { role: "system", content: "You are a helpful support agent." },
 *       { role: "user", content: query }
 *     ]
 *   });
 * }, { name: "customer-support" });
 *
 * // Use it
 * await supportAgent("How do I reset my password?");
 *
 * // With conversation tracking
 * await supportAgent("Thanks!", { sessionId: "session-123" });
 * ```
 *
 * @packageDocumentation
 */

import { initializeEnvironment } from "./env";

// Initialize environment variables on import
// This syncs HONE_* env vars to LANGSMITH_* so wrappers work correctly
initializeEnvironment();

// ============================================================================
// Main API - This is what most users need
// ============================================================================

/**
 * The main Hone SDK export.
 *
 * - `hone(client)` - Wrap an LLM client (OpenAI, Anthropic) for tracing
 * - `hone.agent(fn, config)` - Define an agent with a name
 */
export { hone, agent } from "./hone";
export type { AgentConfig, HoneAgent } from "./hone";

// ============================================================================
// Advanced - For users who need more control
// ============================================================================

// Client for direct API access
export { Client } from "./client";
export type { HoneClientConfig } from "./client";

// Environment utilities
export { getProjectName, getApiKey, isTracingEnabled } from "./env";

// Version
export const VERSION = "0.1.0";

// ============================================================================
// Legacy/LangSmith compatibility - Deprecated, use hone() instead
// ============================================================================

// These are kept for backwards compatibility but users should migrate to hone()
export { wrapOpenAI } from "./wrappers";
export {
  traceable,
  getCurrentRunTree,
  isTraceableFunction,
  RunTree,
} from "./traceable";
export type { TraceableFunction, HoneTraceableConfig } from "./traceable";
