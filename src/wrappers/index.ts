/**
 * Hone Wrappers
 *
 * Re-exports LangSmith's auto-instrumentation wrappers for LLM providers.
 */

// Re-export wrappers from LangSmith
export { wrapOpenAI } from "langsmith/wrappers/openai";

// Note: Anthropic wrapper is not available in langsmith TypeScript SDK
// For Anthropic tracing, use the traceable() decorator directly
