/**
 * Portions of this code adapted from LangSmith SDK
 * Copyright (c) 2023 LangChain
 * Licensed under MIT License
 * https://github.com/langchain-ai/langsmith-sdk
 */

import type { LLMInfo, CompletionResponse } from './types.js';

/**
 * Generate a UUID v4 string.
 * Uses crypto.randomUUID if available, otherwise falls back to manual generation.
 */
export function generateUUID(): string {
  // Use native crypto.randomUUID if available (Node 19+, modern browsers)
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  // Fallback UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get current timestamp in ISO format.
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Get current time in milliseconds.
 */
export function getCurrentTimeMs(): number {
  return Date.now();
}

/**
 * Calculate elapsed time in milliseconds.
 */
export function getElapsedMs(startTimeMs: number): number {
  return Date.now() - startTimeMs;
}

/**
 * Sleep for a specified number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create an exponential backoff delay calculator.
 */
export function calculateBackoffMs(
  attempt: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000
): number {
  const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  // Add jitter to prevent thundering herd
  const jitter = delay * 0.1 * Math.random();
  return Math.floor(delay + jitter);
}

/**
 * Safely serialize an object to JSON, handling circular references.
 */
export function safeStringify(obj: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    // Handle special types
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'function') {
      return `[Function: ${value.name || 'anonymous'}]`;
    }
    return value;
  });
}

/**
 * Safely parse JSON with a fallback value.
 */
export function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Extract function arguments as a record.
 */
export function extractArgs(
  fn: (...args: unknown[]) => unknown,
  args: unknown[]
): Record<string, unknown> {
  // Try to extract parameter names from function signature
  const fnStr = fn.toString();
  const paramMatch = fnStr.match(/\(([^)]*)\)/);
  const paramNames = paramMatch
    ? paramMatch[1]
        .split(',')
        .map((p) => p.trim().split(/[=:]/)[0].trim())
        .filter((p) => p && !p.startsWith('...'))
    : [];

  const result: Record<string, unknown> = {};

  args.forEach((arg, index) => {
    const paramName = paramNames[index] || `arg${index}`;
    result[paramName] = arg;
  });

  return result;
}

/**
 * Check if a value is a Promise.
 */
export function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'then' in value &&
    typeof (value as Promise<T>).then === 'function'
  );
}

/**
 * Check if a value looks like an OpenAI-style completion response.
 */
export function isCompletionResponse(
  value: unknown
): value is CompletionResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    ('choices' in obj && Array.isArray(obj.choices)) ||
    ('usage' in obj && typeof obj.usage === 'object')
  );
}

/**
 * Extract LLM-specific information from a response.
 */
export function extractLLMInfo(response: unknown): LLMInfo {
  const info: LLMInfo = {};

  if (!isCompletionResponse(response)) {
    return info;
  }

  // Extract token usage
  if (response.usage) {
    info.tokensUsed = response.usage.total_tokens;
  }

  // Extract model name
  if (response.model) {
    info.model = response.model;
  }

  return info;
}

/**
 * Truncate a string to a maximum length.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Deep clone an object.
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }
  const cloned = {} as Record<string, unknown>;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
  }
  return cloned as T;
}

/**
 * Merge two objects deeply.
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Get environment variable (works in both Node.js and browser).
 */
export function getEnvVar(name: string, defaultValue?: string): string | undefined {
  // Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name] ?? defaultValue;
  }
  // Browser - no env vars available
  return defaultValue;
}

/**
 * Check if running in Node.js environment.
 */
export function isNodeEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  );
}

/**
 * Check if running in browser environment.
 */
export function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Create a deferred promise.
 */
export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Estimate the byte size of a JSON-serializable object.
 */
export function estimateByteSize(obj: unknown): number {
  try {
    const str = safeStringify(obj);
    // Use TextEncoder if available (more accurate for Unicode)
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str).length;
    }
    // Fallback: approximate byte count
    return str.length * 2;
  } catch {
    return 0;
  }
}
