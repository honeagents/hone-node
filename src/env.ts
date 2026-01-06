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
