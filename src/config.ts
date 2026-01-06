/**
 * Hone SDK Configuration
 *
 * Constants and configuration for the Hone SDK wrapper.
 */

/** Default Hone API endpoint */
export const HONE_DEFAULT_ENDPOINT = "https://api.honeagents.ai";

/** Environment variable prefix for Hone */
export const HONE_ENV_PREFIX = "HONE";

/** Environment variable namespace search order */
export const ENV_NAMESPACES = ["HONE", "LANGSMITH", "LANGCHAIN"] as const;

/** SDK version */
export const VERSION = "0.1.0";
