/**
 * Portions of this code adapted from LangSmith SDK
 * Copyright (c) 2023 LangChain
 * Licensed under MIT License
 * https://github.com/langchain-ai/langsmith-sdk
 */

/**
 * Configuration options for the Hone client.
 */
export interface HoneOptions {
  /**
   * The base URL for the Hone API.
   * Defaults to 'https://api.hone.ai'
   */
  apiUrl?: string;

  /**
   * Maximum number of tracked calls to batch before sending.
   * Defaults to 100.
   */
  batchSize?: number;

  /**
   * Interval in milliseconds between automatic flush operations.
   * Defaults to 1000 (1 second).
   */
  flushIntervalMs?: number;

  /**
   * Maximum number of retry attempts for failed requests.
   * Defaults to 3.
   */
  maxRetries?: number;

  /**
   * Request timeout in milliseconds.
   * Defaults to 30000 (30 seconds).
   */
  timeoutMs?: number;

  /**
   * Enable debug logging.
   * Defaults to false.
   */
  debug?: boolean;
}

/**
 * Options for the track wrapper/decorator.
 */
export interface TrackOptions {
  /**
   * Custom name for the tracked function.
   * If not provided, uses the original function name.
   */
  name?: string;

  /**
   * Additional metadata to attach to tracked calls.
   */
  metadata?: Record<string, unknown>;

  /**
   * Tags to categorize the tracked call.
   */
  tags?: string[];
}

/**
 * Represents a tracked LLM call.
 */
export interface TrackedCall {
  /**
   * Unique identifier for the tracked call.
   */
  id: string;

  /**
   * The project ID this call belongs to.
   */
  projectId: string;

  /**
   * Name of the tracked function.
   */
  functionName: string;

  /**
   * Input arguments to the function.
   */
  input: Record<string, unknown>;

  /**
   * Output/return value from the function.
   */
  output: unknown;

  /**
   * Duration of the call in milliseconds.
   */
  durationMs: number;

  /**
   * Number of tokens used (if applicable).
   */
  tokensUsed?: number;

  /**
   * The model used (if applicable).
   */
  model?: string;

  /**
   * Cost in USD (if applicable).
   */
  costUsd?: number;

  /**
   * Additional metadata attached to the call.
   */
  metadata?: Record<string, unknown>;

  /**
   * Tags for categorization.
   */
  tags?: string[];

  /**
   * Timestamp when the call was created.
   */
  createdAt: Date;

  /**
   * Error message if the call failed.
   */
  error?: string;
}

/**
 * Internal representation of a pending tracked call
 * that hasn't been sent to the API yet.
 */
export interface PendingTrackedCall {
  id: string;
  projectId: string;
  functionName: string;
  input: Record<string, unknown>;
  output: unknown;
  durationMs: number;
  tokensUsed?: number;
  model?: string;
  costUsd?: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
  createdAt: string; // ISO string for JSON serialization
  error?: string;
}

/**
 * Response from the /v1/track endpoint.
 */
export interface TrackResponse {
  success: boolean;
  trackedCount: number;
  errors?: string[];
}

/**
 * Batch upload request payload.
 */
export interface BatchTrackRequest {
  calls: PendingTrackedCall[];
}

/**
 * Type for the internal queue item.
 */
export interface QueueItem {
  call: PendingTrackedCall;
  resolve: () => void;
  reject: (error: Error) => void;
}

/**
 * Generic function type that can be tracked.
 */
export type TrackableFunction<T extends unknown[], R> = (...args: T) => R;

/**
 * Async function type.
 */
export type AsyncFunction<T extends unknown[], R> = (
  ...args: T
) => Promise<R>;

/**
 * Sync or async function type.
 */
export type AnyFunction<T extends unknown[], R> =
  | TrackableFunction<T, R>
  | AsyncFunction<T, R>;

/**
 * Status of the background processor.
 */
export type ProcessorStatus = 'idle' | 'running' | 'shutdown';

/**
 * Result of extracting LLM-specific info from function results.
 */
export interface LLMInfo {
  tokensUsed?: number;
  model?: string;
  costUsd?: number;
}

/**
 * Message format for LLM calls (OpenAI-style).
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string;
  name?: string;
}

/**
 * OpenAI-style completion response structure.
 */
export interface CompletionResponse {
  id?: string;
  choices?: Array<{
    message?: ChatMessage;
    text?: string;
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
}
