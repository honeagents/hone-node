/**
 * Portions of this code adapted from LangSmith SDK
 * Copyright (c) 2023 LangChain
 * Licensed under MIT License
 * https://github.com/langchain-ai/langsmith-sdk
 */

import type {
  HoneOptions,
  TrackOptions,
  PendingTrackedCall,
  AnyFunction,
} from './types.js';
import {
  BackgroundProcessor,
  type BackgroundProcessorConfig,
} from './background.js';
import {
  generateUUID,
  getCurrentTimeMs,
  getCurrentTimestamp,
  getElapsedMs,
  isPromise,
  extractLLMInfo,
  safeStringify,
  getEnvVar,
} from './utils.js';

/**
 * Default configuration values.
 */
const DEFAULT_OPTIONS: Required<HoneOptions> = {
  apiUrl: 'https://api.hone.ai',
  batchSize: 100,
  flushIntervalMs: 1000,
  maxRetries: 3,
  timeoutMs: 30000,
  debug: false,
};

/**
 * Hone SDK client for tracking and evaluating LLM calls.
 *
 * @example
 * ```typescript
 * import { Hone } from '@aix/sdk';
 *
 * const aix = new Hone('hone_xxx', 'my-project');
 *
 * // Function wrapper style
 * const trackedFn = aix.track(originalFn, { name: 'myLLMCall' });
 *
 * // Or with a class method decorator
 * class MyService {
 *   @hone.trackMethod()
 *   async callLLM(msg: string) { ... }
 * }
 * ```
 */
export class Hone {
  private readonly apiKey: string;
  private readonly projectId: string;
  private readonly options: Required<HoneOptions>;
  private readonly processor: BackgroundProcessor;
  private isShutdown = false;

  /**
   * Create a new Hone client.
   *
   * @param apiKey - Your Hone API key
   * @param projectId - Your project ID
   * @param options - Optional configuration options
   */
  constructor(apiKey: string, projectId: string, options?: HoneOptions) {
    // Validate required parameters
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Hone: apiKey is required and must be a string');
    }
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Hone: projectId is required and must be a string');
    }

    this.apiKey = apiKey;
    this.projectId = projectId;

    // Merge options with defaults, also checking env vars
    const debugEnv = getEnvVar('HONE_DEBUG');
    const debugFromEnv = debugEnv !== undefined ? debugEnv.toLowerCase() === 'true' : undefined;
    this.options = {
      apiUrl: options?.apiUrl ?? getEnvVar('HONE_API_URL') ?? DEFAULT_OPTIONS.apiUrl,
      batchSize: options?.batchSize ?? DEFAULT_OPTIONS.batchSize,
      flushIntervalMs: options?.flushIntervalMs ?? DEFAULT_OPTIONS.flushIntervalMs,
      maxRetries: options?.maxRetries ?? DEFAULT_OPTIONS.maxRetries,
      timeoutMs: options?.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs,
      debug: options?.debug ?? debugFromEnv ?? DEFAULT_OPTIONS.debug,
    };

    // Create the background processor
    const processorConfig: BackgroundProcessorConfig = {
      apiUrl: this.options.apiUrl,
      apiKey: this.apiKey,
      projectId: this.projectId,
      batchSize: this.options.batchSize,
      flushIntervalMs: this.options.flushIntervalMs,
      maxRetries: this.options.maxRetries,
      timeoutMs: this.options.timeoutMs,
      debug: this.options.debug,
    };

    this.processor = new BackgroundProcessor(processorConfig);

    if (this.options.debug) {
      console.log('[Hone] Client initialized', {
        projectId: this.projectId,
        apiUrl: this.options.apiUrl,
        batchSize: this.options.batchSize,
        flushIntervalMs: this.options.flushIntervalMs,
      });
    }
  }

  /**
   * Wrap a function to automatically track its calls.
   *
   * @param fn - The function to wrap
   * @param options - Optional tracking options
   * @returns The wrapped function with tracking
   *
   * @example
   * ```typescript
   * const trackedFn = aix.track(async (msg) => {
   *   return await openai.chat.completions.create({ ... });
   * }, { name: 'chat-completion' });
   *
   * const result = await trackedFn('Hello');
   * ```
   */
  track<T extends unknown[], R>(
    fn: AnyFunction<T, R>,
    options?: TrackOptions
  ): (...args: T) => Promise<Awaited<R>> {
    const functionName = options?.name ?? fn.name ?? 'anonymous';
    const metadata = options?.metadata;
    const tags = options?.tags;

    // Return a wrapped function
    return async (...args: T): Promise<Awaited<R>> => {
      if (this.isShutdown) {
        // If shutdown, just call the original function
        const rawResult = fn(...args);
        return isPromise(rawResult) ? await rawResult : (rawResult as Awaited<R>);
      }

      const callId = generateUUID();
      const startTimeMs = getCurrentTimeMs();
      let result: Awaited<R> | undefined;
      let error: Error | undefined;

      try {
        // Call the original function
        const rawResult = fn(...args);

        // If it's a promise, await it
        if (isPromise(rawResult)) {
          result = await rawResult as Awaited<R>;
        } else {
          result = rawResult as Awaited<R>;
        }
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err));
        throw error;
      } finally {
        // Calculate duration
        const durationMs = getElapsedMs(startTimeMs);

        // Extract LLM-specific info from the result
        const llmInfo = error ? {} : extractLLMInfo(result);

        // Build the tracked call object
        const trackedCall: PendingTrackedCall = {
          id: callId,
          projectId: this.projectId,
          functionName,
          input: this.sanitizeInput(this.extractArgsFromArray(args)),
          output: error ? null : this.sanitizeOutput(result),
          durationMs,
          tokensUsed: llmInfo.tokensUsed,
          model: llmInfo.model,
          costUsd: llmInfo.costUsd,
          metadata,
          tags,
          createdAt: getCurrentTimestamp(),
          error: error?.message,
        };

        // Enqueue for background processing (don't await)
        this.processor.enqueue(trackedCall).catch((enqueueError) => {
          if (this.options.debug) {
            console.error(
              '[Hone] Failed to enqueue tracked call:',
              enqueueError
            );
          }
        });
      }

      return result as Awaited<R>;
    };
  }

  /**
   * TypeScript method decorator for class methods.
   *
   * @param options - Optional tracking options
   * @returns A method decorator
   *
   * @example
   * ```typescript
   * class MyService {
   *   @hone.trackMethod({ name: 'chat' })
   *   async chat(message: string) {
   *     return await openai.chat.completions.create({ ... });
   *   }
   * }
   * ```
   */
  trackMethod(options?: TrackOptions): MethodDecorator {
    return (
      _target: object,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor
    ): PropertyDescriptor => {
      const originalMethod = descriptor.value;

      if (typeof originalMethod !== 'function') {
        throw new Error(
          `@trackMethod can only be applied to methods, not ${typeof originalMethod}`
        );
      }

      const functionName =
        options?.name ?? String(propertyKey) ?? 'anonymous';
      const trackedFn = this.track(originalMethod, {
        ...options,
        name: functionName,
      });

      descriptor.value = function (this: unknown, ...args: unknown[]) {
        return trackedFn.apply(this, args);
      };

      return descriptor;
    };
  }

  /**
   * Manually flush all pending tracked calls.
   *
   * Call this before your application exits or when you need
   * to ensure all tracked calls have been sent.
   *
   * @returns A promise that resolves when all pending calls are sent
   *
   * @example
   * ```typescript
   * // Before application exit
   * await aix.flush();
   * process.exit(0);
   * ```
   */
  async flush(): Promise<void> {
    if (this.options.debug) {
      console.log('[Hone] Manual flush requested');
    }
    await this.processor.flush();
  }

  /**
   * Gracefully shutdown the Hone client.
   *
   * This flushes all pending calls and prevents new tracking.
   * Call this before your application exits.
   *
   * @returns A promise that resolves when shutdown is complete
   *
   * @example
   * ```typescript
   * // Graceful shutdown handler
   * process.on('SIGTERM', async () => {
   *   await aix.shutdown();
   *   process.exit(0);
   * });
   * ```
   */
  async shutdown(): Promise<void> {
    if (this.isShutdown) {
      return;
    }

    if (this.options.debug) {
      console.log('[Hone] Shutdown requested');
    }

    this.isShutdown = true;
    await this.processor.shutdown();

    if (this.options.debug) {
      console.log('[Hone] Shutdown complete');
    }
  }

  /**
   * Get the current number of pending tracked calls in the queue.
   */
  getQueueSize(): number {
    return this.processor.getQueueSize();
  }

  /**
   * Check if the client has been shutdown.
   */
  isShutdownComplete(): boolean {
    return this.isShutdown;
  }

  /**
   * Extract arguments from an array into a record.
   */
  private extractArgsFromArray(args: unknown[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    args.forEach((arg, index) => {
      result[`arg${index}`] = arg;
    });
    return result;
  }

  /**
   * Sanitize input for safe serialization.
   */
  private sanitizeInput(input: Record<string, unknown>): Record<string, unknown> {
    try {
      // Test if it can be serialized
      const serialized = safeStringify(input);
      return JSON.parse(serialized);
    } catch {
      return { _error: 'Input could not be serialized' };
    }
  }

  /**
   * Sanitize output for safe serialization.
   */
  private sanitizeOutput(output: unknown): unknown {
    try {
      // Test if it can be serialized
      const serialized = safeStringify(output);
      return JSON.parse(serialized);
    } catch {
      return { _error: 'Output could not be serialized' };
    }
  }
}
