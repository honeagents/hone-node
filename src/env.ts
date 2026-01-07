/**
 * Hone SDK Environment Utilities
 *
 * Functions for reading environment variables with Hone namespace priority.
 */

import { ENV_NAMESPACES, HONE_DEFAULT_ENDPOINT } from "./config";

/**
 * Get an environment variable with Hone namespace priority.
 *
 * Searches in order: HONE_<name>, LANGSMITH_<name>, LANGCHAIN_<name>
 *
 * @param name - The variable name suffix (e.g., "API_KEY")
 * @param defaultValue - Default value if not found
 * @returns The environment variable value or default
 */
export function getEnvVar(
  name: string,
  defaultValue?: string
): string | undefined {
  // Handle both Node.js and browser environments
  const env =
    typeof process !== "undefined" && process.env ? process.env : {};

  for (const namespace of ENV_NAMESPACES) {
    const envName = `${namespace}_${name}`;
    const value = env[envName];
    if (value !== undefined && value.trim() !== "") {
      return value;
    }
  }

  return defaultValue;
}

/**
 * Get the Hone API URL.
 *
 * Priority:
 * 1. Explicit apiUrl parameter
 * 2. HONE_ENDPOINT environment variable
 * 3. LANGSMITH_ENDPOINT environment variable
 * 4. LANGCHAIN_ENDPOINT environment variable
 * 5. Default Hone endpoint
 *
 * @param apiUrl - Optional explicit API URL
 * @returns The API URL to use
 */
export function getApiUrl(apiUrl?: string): string {
  if (apiUrl) {
    return apiUrl;
  }

  return getEnvVar("ENDPOINT", HONE_DEFAULT_ENDPOINT) || HONE_DEFAULT_ENDPOINT;
}

/**
 * Get the Hone API key.
 *
 * @param apiKey - Optional explicit API key
 * @returns The API key or undefined
 */
export function getApiKey(apiKey?: string): string | undefined {
  if (apiKey) {
    return apiKey;
  }

  return getEnvVar("API_KEY");
}

/**
 * Get the Hone project name.
 *
 * @param projectName - Optional explicit project name
 * @returns The project name or "default"
 */
export function getProjectName(projectName?: string): string {
  if (projectName) {
    return projectName;
  }

  return getEnvVar("PROJECT", "default") || "default";
}

/**
 * Check if tracing is enabled.
 *
 * @returns True if tracing is enabled
 */
export function isTracingEnabled(): boolean {
  const value = getEnvVar("TRACING", "true");
  return value?.toLowerCase() === "true";
}

/**
 * Initialize LangSmith environment variables from Hone configuration.
 *
 * This function syncs HONE_* environment variables to their LANGSMITH_*
 * equivalents so that LangSmith's wrappers (wrapOpenAI, traceable) work
 * correctly with Hone's backend.
 *
 * Called automatically when the SDK is imported.
 */
export function initializeEnvironment(): void {
  // Only run in Node.js environment
  if (typeof process === "undefined" || !process.env) {
    return;
  }

  // Sync HONE_ENDPOINT to LANGSMITH_ENDPOINT and LANGCHAIN_ENDPOINT
  const endpoint = process.env.HONE_ENDPOINT;
  if (endpoint) {
    if (!process.env.LANGSMITH_ENDPOINT) {
      process.env.LANGSMITH_ENDPOINT = endpoint;
    }
    if (!process.env.LANGCHAIN_ENDPOINT) {
      process.env.LANGCHAIN_ENDPOINT = endpoint;
    }
  }

  // Sync HONE_API_KEY to LANGSMITH_API_KEY and LANGCHAIN_API_KEY
  const apiKey = process.env.HONE_API_KEY;
  if (apiKey) {
    if (!process.env.LANGSMITH_API_KEY) {
      process.env.LANGSMITH_API_KEY = apiKey;
    }
    if (!process.env.LANGCHAIN_API_KEY) {
      process.env.LANGCHAIN_API_KEY = apiKey;
    }
  }

  // Sync HONE_PROJECT to LANGSMITH_PROJECT and LANGCHAIN_PROJECT
  const project = process.env.HONE_PROJECT;
  if (project) {
    if (!process.env.LANGSMITH_PROJECT) {
      process.env.LANGSMITH_PROJECT = project;
    }
    if (!process.env.LANGCHAIN_PROJECT) {
      process.env.LANGCHAIN_PROJECT = project;
    }
  }

  // Enable tracing by default for Hone (HONE_TRACING defaults to true)
  const tracing = process.env.HONE_TRACING;
  if (tracing === undefined || tracing === "true") {
    if (!process.env.LANGSMITH_TRACING) {
      process.env.LANGSMITH_TRACING = "true";
    }
    if (!process.env.LANGCHAIN_TRACING_V2) {
      process.env.LANGCHAIN_TRACING_V2 = "true";
    }
  }
}
