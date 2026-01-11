/**
 * Hone Traceable Module
 *
 * Wraps LangSmith's tracing decorators with Hone-specific options.
 * Adds support for explicit agent identification across system prompt changes.
 */

import {
  traceable as langsmithTraceable,
  getCurrentRunTree,
  isTraceableFunction,
  type TraceableFunction,
} from "langsmith/traceable";
import type { RunTreeConfig } from "langsmith/run_trees";

// Re-export RunTree for manual trace management
export { RunTree } from "langsmith/run_trees";

// Re-export utilities
export { getCurrentRunTree, isTraceableFunction };

// Re-export types
export type { RunTreeConfig, TraceableFunction };

/**
 * Hone-specific configuration options for traceable functions.
 */
export interface HoneTraceableConfig<
  _Func extends (...args: any[]) => any = (...args: any[]) => any,
> extends Partial<Omit<RunTreeConfig, "inputs" | "outputs">> {
  /**
   * Session ID for grouping multiple calls into a conversation.
   *
   * @example
   * ```typescript
   * const response = await myAgent("Hello", {
   *   sessionId: "user-123-session-456"
   * });
   * ```
   */
  sessionId?: string;

  /**
   * LangSmith-compatible config options.
   */
  aggregator?: (args: any[]) => any;
  argsConfigPath?: [number] | [number, string];
  __finalTracedIteratorKey?: string;
}

/**
 * Wraps a function to automatically trace its execution with Hone.
 *
 * This is the primary way to instrument your code for tracing. All calls to
 * traced functions are automatically logged with inputs, outputs, timing,
 * and any errors.
 *
 * Hone extends LangSmith's traceable with additional options:
 * - `sessionId`: Group calls into conversations
 *
 * @param wrappedFunc The function to trace
 * @param config Configuration options including name, tags, metadata, and Hone-specific options
 * @returns A traced version of the function
 *
 * @example Basic usage
 * ```typescript
 * const myFunction = traceable(
 *   async (query: string) => {
 *     // Your code here
 *     return "result";
 *   },
 *   { name: "my-function" }
 * );
 * ```
 *
 * @example With agent identification
 * ```typescript
 * const customerSupportAgent = traceable(
 *   async (message: string) => {
 *     // LLM call here
 *     return response;
 *   },
 *   {
 *     name: "customer-support",
 *     agentId: "customer-support-v1",  // Stable ID across prompt changes
 *     runType: "chain"
 *   }
 * );
 * ```
 *
 * @example With session tracking
 * ```typescript
 * const chatBot = traceable(
 *   async (message: string, context: { sessionId: string }) => {
 *     // Chat logic
 *     return response;
 *   },
 *   {
 *     name: "chatbot",
 *     agentId: "main-chatbot"
 *   }
 * );
 *
 * // Usage with session
 * await chatBot("Hello", { sessionId: "user-session-123" });
 * ```
 */
export function traceable<Func extends (...args: any[]) => any>(
  wrappedFunc: Func,
  config?: HoneTraceableConfig<Func>,
): TraceableFunction<Func> {
  if (!config) {
    return langsmithTraceable(wrappedFunc);
  }

  // Extract Hone-specific options
  const { sessionId, ...langsmithConfig } = config;

  // Build metadata with Hone-specific fields
  const honeMetadata: Record<string, unknown> = {
    ...(config.metadata || {}),
  };

  // Add session ID (use the first non-null value)
  const effectiveSessionId = sessionId;
  if (effectiveSessionId) {
    honeMetadata.session_id = effectiveSessionId;
    honeMetadata.thread_id = effectiveSessionId;
  }

  // Pass to LangSmith traceable with merged metadata
  return langsmithTraceable(wrappedFunc, {
    ...langsmithConfig,
    metadata: honeMetadata,
  } as any);
}
