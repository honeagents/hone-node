/**
 * Hone SDK Configuration Constants
 */

/** Default Hone API endpoint */
export const HONE_DEFAULT_ENDPOINT = "https://api.honeagents.ai";

/** Environment variable prefix for Hone */
export const HONE_ENV_PREFIX = "HONE";

/**
 * Environment variable namespace search order.
 * HONE_* takes priority, then falls back to LANGSMITH_* for migration ease.
 */
export const ENV_NAMESPACES = ["HONE", "LANGSMITH", "LANGCHAIN"] as const;

/** SDK version */
export const VERSION = "0.1.0";
