/**
 * Hone SDK Patch Module
 *
 * This module provides utilities to override LangSmith's default configuration
 * to use Hone's API endpoint and environment variables.
 */

import { HONE_DEFAULT_ENDPOINT, ENV_NAMESPACES } from "./config";

/**
 * Get an environment variable with Hone namespace priority.
 *
 * Searches for environment variables in order:
 * 1. HONE_<name>
 * 2. LANGSMITH_<name>
 * 3. LANGCHAIN_<name>
 * 4. Returns undefined
 *
 * @param name - The variable name suffix (e.g., "API_KEY")
 * @returns The environment variable value or undefined
 */
export function getEnvVar(name: string): string | undefined {
  for (const namespace of ENV_NAMESPACES) {
    const envName = `${namespace}_${name}`;
    const value = process.env[envName];
    if (value !== undefined && value.trim() !== "") {
      return value;
    }
  }
  return undefined;
}

/**
 * Get the Hone API URL.
 *
 * Priority:
 * 1. Explicit apiUrl parameter
 * 2. HONE_ENDPOINT environment variable
 * 3. LANGSMITH_ENDPOINT environment variable (for migration)
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
  return getEnvVar("ENDPOINT") ?? HONE_DEFAULT_ENDPOINT;
}

/**
 * Get the Hone API key.
 *
 * Searches HONE_API_KEY, then LANGSMITH_API_KEY, then LANGCHAIN_API_KEY.
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
 * Get the project name.
 *
 * @param projectName - Optional explicit project name
 * @returns The project name or "default"
 */
export function getProjectName(projectName?: string): string {
  if (projectName) {
    return projectName;
  }
  return getEnvVar("PROJECT") ?? "default";
}

/**
 * Check if tracing is enabled.
 *
 * @returns true if tracing is enabled
 */
export function isTracingEnabled(): boolean {
  const tracingVar = getEnvVar("TRACING");
  if (tracingVar === undefined) {
    return true; // Default to enabled
  }
  return tracingVar.toLowerCase() === "true";
}
