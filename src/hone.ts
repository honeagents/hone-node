/**
 * Hone SDK - Unified API
 *
 * Simple, clean API for agent observability and evaluation.
 *
 * @example
 * ```typescript
 * import { hone } from "hone-sdk";
 *
 * // Wrap LLM clients for automatic tracing
 * const openai = hone(new OpenAI());
 * const anthropic = hone(new Anthropic());
 *
 * // Define agents with required name
 * const supportAgent = hone.agent(async (query) => {
 *   return await openai.chat.completions.create({
 *     messages: [
 *       { role: "system", content: "You are helpful..." },
 *       { role: "user", content: query }
 *     ]
 *   });
 * }, { name: "customer-support" });
 *
 * // Call with optional session for conversation tracking
 * await supportAgent("Hello!", { sessionId: "session-123" });
 * ```
 */

import { traceable as langsmithTraceable } from "langsmith/traceable";
import { wrapOpenAI } from "langsmith/wrappers";
import type { TraceableFunction } from "langsmith/traceable";
import { getProjectName } from "./env";

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for defining an agent.
 */
export interface AgentConfig {
  /**
   * The name of this agent. Required.
   * Used as the agent identifier within your project.
   * The full ID will be "{project}:{name}" to ensure uniqueness.
   *
   * @example "customer-support", "sales-bot", "code-reviewer"
   */
  name: string;

  /**
   * @deprecated Session IDs are no longer used. Evaluation is now at the trace level.
   * Each trace (execution) is evaluated independently.
   */
  sessionId?: string;
}

/**
 * Runtime options that can be passed when calling an agent.
 */
export interface AgentCallOptions {
  /**
   * Session ID for this specific call.
   * Overrides the sessionId from config if provided.
   */
  sessionId?: string;
}

/**
 * A wrapped agent function that can be called with optional runtime options.
 */
export type HoneAgent<Func extends (...args: any[]) => any> = TraceableFunction<Func>;

// ============================================================================
// Client Detection
// ============================================================================

interface OpenAILike {
  chat: { completions: { create: (...args: any[]) => any } };
  completions: { create: (...args: any[]) => any };
}

interface AnthropicLike {
  messages: { create: (...args: any[]) => any };
}

function isOpenAIClient(client: unknown): client is OpenAILike {
  return (
    typeof client === "object" &&
    client !== null &&
    "chat" in client &&
    typeof (client as any).chat?.completions?.create === "function"
  );
}

function isAnthropicClient(client: unknown): client is AnthropicLike {
  return (
    typeof client === "object" &&
    client !== null &&
    "messages" in client &&
    typeof (client as any).messages?.create === "function"
  );
}

// ============================================================================
// Agent Wrapper
// ============================================================================

/**
 * Wraps a function as a Hone agent.
 *
 * @param fn - The agent function to wrap
 * @param config - Agent configuration with required name
 * @returns A wrapped function that traces calls to Hone
 *
 * @example
 * ```typescript
 * const supportAgent = hone.agent(async (query: string) => {
 *   return await openai.chat.completions.create({
 *     messages: [
 *       { role: "system", content: "You are a helpful support agent." },
 *       { role: "user", content: query }
 *     ]
 *   });
 * }, { name: "customer-support" });
 *
 * // Call the agent
 * const response = await supportAgent("How do I reset my password?");
 *
 * // Call with session for conversation tracking
 * const response = await supportAgent("Thanks!", { sessionId: "sess-123" });
 * ```
 */
function agent<Func extends (...args: any[]) => any>(
  fn: Func,
  config: AgentConfig
): HoneAgent<Func> {
  const { name, sessionId } = config;

  // Build the full agent ID: "{project}:{name}"
  const project = getProjectName();
  const fullAgentId = project ? `${project}:${name}` : name;

  // Build metadata
  const metadata: Record<string, unknown> = {
    hone_agent_id: fullAgentId,
  };

  if (sessionId) {
    metadata.session_id = sessionId;
    metadata.thread_id = sessionId;
  }

  // Wrap with langsmith traceable
  return langsmithTraceable(fn, {
    name,
    run_type: "chain",
    metadata,
  }) as HoneAgent<Func>;
}

// ============================================================================
// Client Wrapper
// ============================================================================

/**
 * Wraps an LLM client for automatic tracing.
 * Automatically detects OpenAI and Anthropic clients.
 *
 * @param client - An LLM client instance (OpenAI, Anthropic, etc.)
 * @returns The wrapped client with tracing enabled
 *
 * @example
 * ```typescript
 * import OpenAI from "openai";
 * import Anthropic from "@anthropic-ai/sdk";
 *
 * const openai = hone(new OpenAI());
 * const anthropic = hone(new Anthropic());
 *
 * // Use as normal - calls are automatically traced
 * await openai.chat.completions.create({ ... });
 * await anthropic.messages.create({ ... });
 * ```
 */
function wrapClient<T>(client: T): T {
  if (isOpenAIClient(client)) {
    return wrapOpenAI(client as any) as T;
  }

  if (isAnthropicClient(client)) {
    // For now, use generic wrapping for Anthropic
    // TODO: Add dedicated Anthropic wrapper when langsmith supports it better
    console.warn(
      "[hone] Anthropic client detected. Using basic wrapping. " +
        "For best results, wrap individual calls with hone.agent()."
    );
    return client;
  }

  // Unknown client type - return as-is with warning
  console.warn(
    "[hone] Unknown client type. Returning unwrapped. " +
      "Supported clients: OpenAI, Anthropic"
  );
  return client;
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * The main Hone SDK function.
 *
 * Use `hone(client)` to wrap LLM clients for automatic tracing.
 * Use `hone.agent(fn, config)` to define agents.
 *
 * @example
 * ```typescript
 * import { hone } from "hone-sdk";
 * import OpenAI from "openai";
 *
 * // Wrap the OpenAI client
 * const openai = hone(new OpenAI());
 *
 * // Define an agent
 * const supportAgent = hone.agent(async (query) => {
 *   return await openai.chat.completions.create({
 *     messages: [
 *       { role: "system", content: "You are helpful..." },
 *       { role: "user", content: query }
 *     ]
 *   });
 * }, { name: "customer-support" });
 *
 * // Use the agent
 * await supportAgent("Hello!");
 * ```
 */
export const hone = Object.assign(wrapClient, {
  agent,
});

// Also export the agent function directly for convenience
export { agent };
