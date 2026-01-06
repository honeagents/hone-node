/**
 * Hone Traceable Module
 *
 * Re-exports LangSmith's tracing decorators and utilities.
 * These work identically to LangSmith but route to Hone's backend.
 */

// Re-export traceable decorator and utilities
export {
  traceable,
  getCurrentRunTree,
  isTraceableFunction,
  type RunTreeConfig,
  type TraceableFunction,
} from "langsmith/traceable";

// Re-export RunTree for manual trace management
export { RunTree } from "langsmith/run_trees";
