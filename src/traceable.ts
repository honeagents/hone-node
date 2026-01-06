/**
 * Hone Traceable
 *
 * Re-exports LangSmith's traceable decorator with Hone configuration applied.
 */

// Re-export traceable from LangSmith
// The traceable decorator will use our patched environment variables
export {
  traceable,
  getCurrentRunTree,
  isTraceableFunction,
  withRunTree,
  ROOT,
} from "langsmith/traceable";

export type { RunTreeLike, TraceableFunction } from "langsmith/traceable";
