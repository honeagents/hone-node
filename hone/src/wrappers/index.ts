/**
 * Hone Wrappers Module
 *
 * Re-exports LangSmith's auto-instrumentation wrappers for various LLM providers.
 * These wrappers automatically trace LLM calls without requiring decorators.
 *
 * @example
 * ```typescript
 * import { wrapOpenAI } from "@hone/sdk/wrappers";
 * import OpenAI from "openai";
 *
 * const client = wrapOpenAI(new OpenAI());
 * // All calls are now traced automatically
 * ```
 */

export { wrapOpenAI } from "./openai";
export { wrapAnthropic } from "./anthropic";
