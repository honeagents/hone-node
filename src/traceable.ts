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
  withRunTree,
  ROOT,
  type TraceableFunction,
} from "langsmith/traceable";
import type { RunTreeConfig } from "langsmith/run_trees";

// Re-export RunTree for manual trace management
export { RunTree } from "langsmith/run_trees";

// Re-export utilities
export { getCurrentRunTree, isTraceableFunction, withRunTree, ROOT };

// Re-export types
export type { RunTreeConfig, TraceableFunction };
export type { RunTreeLike } from "langsmith/traceable";

/**
 * Hone-specific configuration options for traceable functions.
 */
export interface HoneTraceableConfig<_Func extends (...args: any[]) => any = (...args: any[]) => any>
  extends Partial<Omit<RunTreeConfig, "inputs" | "outputs">> {
  /**
   * Explicit agent identifier. When set, the agent will be tracked by this ID
   * even if the system prompt changes. This is useful for versioning prompts
   * while keeping the same logical agent.
   *
   * If not set, agents are identified by their system prompt hash.
   *
   * @example
   * ```typescript
   * const myAgent = traceable(
   *   async (query: string) => { ... },
   *   {
   *     name: "my-agent",
   *     agentId: "customer-support-v1",  // Tracks this agent across prompt changes
   *   }
   * );
   * ```
   */
  agentId?: string;

  /**
   * The system prompt for this agent. When provided, Hone will track this
   * prompt and detect changes across versions. Required when using agentId
   * if you want Hone to capture the system prompt.
   *
   * @example
   * ```typescript
   * const SYSTEM_PROMPT = "You are a helpful customer support agent...";
   *
   * const myAgent = traceable(
   *   async (query: string) => {
   *     const response = await openai.chat.completions.create({
   *       messages: [
   *         { role: "system", content: SYSTEM_PROMPT },
   *         { role: "user", content: query }
   *       ]
   *     });
   *     return response.choices[0].message.content;
   *   },
   *   {
   *     name: "customer-support",
   *     agentId: "customer-support-v1",
   *     systemPrompt: SYSTEM_PROMPT,  // Pass the same prompt for tracking
   *   }
   * );
   * ```
   */
  systemPrompt?: string;

  /**
   * Session ID for grouping multiple calls into a conversation.
   * Also supports 'threadId' and 'conversationId' as aliases.
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
   * Alias for sessionId - used for conversation grouping.
   */
  threadId?: string;

  /**
   * Alias for sessionId - used for conversation grouping.
   */
  conversationId?: string;

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
 * - `agentId`: Explicitly identify an agent across system prompt changes
 * - `systemPrompt`: The system prompt for this agent (for tracking)
 * - `sessionId`/`threadId`/`conversationId`: Group calls into conversations
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
 * @example With agent identification and system prompt
 * ```typescript
 * const SYSTEM_PROMPT = "You are a helpful assistant...";
 *
 * const customerSupportAgent = traceable(
 *   async (message: string) => {
 *     // LLM call here
 *     return response;
 *   },
 *   {
 *     name: "customer-support",
 *     agentId: "customer-support-v1",  // Stable ID across prompt changes
 *     systemPrompt: SYSTEM_PROMPT,     // Track the system prompt
 *     runType: "chain"
 *   }
 * );
 * ```
 */
export function traceable<Func extends (...args: any[]) => any>(
  wrappedFunc: Func,
  config?: HoneTraceableConfig<Func>
): TraceableFunction<Func> {
  if (!config) {
    return langsmithTraceable(wrappedFunc);
  }

  // Extract Hone-specific options
  const {
    agentId,
    systemPrompt,
    sessionId,
    threadId,
    conversationId,
    ...langsmithConfig
  } = config;

  // Build metadata with Hone-specific fields
  const honeMetadata: Record<string, unknown> = {
    ...(config.metadata || {}),
  };

  // Add agent ID if provided
  if (agentId) {
    honeMetadata.hone_agent_id = agentId;
  }

  // Add system prompt if provided (for agent detection)
  if (systemPrompt) {
    honeMetadata.hone_system_prompt = systemPrompt;
  }

  // Add session ID (use the first non-null value)
  const effectiveSessionId = sessionId || threadId || conversationId;
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
