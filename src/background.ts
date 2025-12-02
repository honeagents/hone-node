/**
 * Portions of this code adapted from LangSmith SDK
 * Copyright (c) 2023 LangChain
 * Licensed under MIT License
 * https://github.com/langchain-ai/langsmith-sdk
 */

import type {
  PendingTrackedCall,
  QueueItem,
  ProcessorStatus,
  TrackResponse,
} from './types.js';
import {
  sleep,
  calculateBackoffMs,
  safeStringify,
  estimateByteSize,
} from './utils.js';

/**
 * Configuration for the background processor.
 */
export interface BackgroundProcessorConfig {
  apiUrl: string;
  apiKey: string;
  projectId: string;
  batchSize: number;
  flushIntervalMs: number;
  maxRetries: number;
  timeoutMs: number;
  debug: boolean;
}

/**
 * HTTP status codes that should trigger a retry.
 */
const RETRYABLE_STATUS_CODES = new Set([
  408, // Request Timeout
  425, // Too Early
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/**
 * Maximum queue size in bytes (1MB default).
 */
const MAX_QUEUE_SIZE_BYTES = 1024 * 1024;

/**
 * Background processor that batches and sends tracked calls to the API.
 *
 * Features:
 * - Queue-based batch processing
 * - Automatic flush on batch size or interval
 * - Retry logic with exponential backoff
 * - Works in both Node.js and browser environments
 */
export class BackgroundProcessor {
  private readonly config: BackgroundProcessorConfig;
  private readonly queue: QueueItem[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private status: ProcessorStatus = 'idle';
  private currentQueueSizeBytes = 0;
  private pendingFlush: Promise<void> | null = null;

  constructor(config: BackgroundProcessorConfig) {
    this.config = config;
  }

  /**
   * Get the current status of the processor.
   */
  getStatus(): ProcessorStatus {
    return this.status;
  }

  /**
   * Get the number of items currently in the queue.
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Add a tracked call to the queue.
   * Returns a promise that resolves when the call is successfully sent.
   */
  enqueue(call: PendingTrackedCall): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const callSize = estimateByteSize(call);

      // Check if queue is full
      if (this.currentQueueSizeBytes + callSize > MAX_QUEUE_SIZE_BYTES) {
        if (this.config.debug) {
          console.warn(
            '[Hone] Queue size limit exceeded, dropping oldest items'
          );
        }
        // Remove oldest items to make space
        while (
          this.queue.length > 0 &&
          this.currentQueueSizeBytes + callSize > MAX_QUEUE_SIZE_BYTES
        ) {
          const dropped = this.queue.shift();
          if (dropped) {
            this.currentQueueSizeBytes -= estimateByteSize(dropped.call);
            dropped.reject(new Error('Dropped from queue due to size limit'));
          }
        }
      }

      this.queue.push({ call, resolve, reject });
      this.currentQueueSizeBytes += callSize;

      if (this.config.debug) {
        console.log(
          `[Hone] Enqueued call: ${call.functionName}, queue size: ${this.queue.length}`
        );
      }

      // Start flush timer if not already running
      this.ensureFlushTimer();

      // Check if we should flush immediately due to batch size
      if (this.queue.length >= this.config.batchSize) {
        this.triggerFlush();
      }
    });
  }

  /**
   * Ensure the flush timer is running.
   */
  private ensureFlushTimer(): void {
    if (this.flushTimer === null && this.status !== 'shutdown') {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.triggerFlush();
      }, this.config.flushIntervalMs);
    }
  }

  /**
   * Trigger a flush operation.
   */
  private triggerFlush(): void {
    // Don't trigger if already flushing or shutdown
    if (this.pendingFlush !== null || this.status === 'shutdown') {
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    this.pendingFlush = this.processQueue().finally(() => {
      this.pendingFlush = null;
      // Restart timer if there are still items
      if (this.queue.length > 0 && this.status !== 'shutdown') {
        this.ensureFlushTimer();
      }
    });
  }

  /**
   * Process the queue and send calls to the API.
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    this.status = 'running';

    // Take a batch from the queue
    const batch = this.queue.splice(0, this.config.batchSize);
    const batchCalls = batch.map((item) => item.call);

    // Update queue size tracking
    for (const item of batch) {
      this.currentQueueSizeBytes -= estimateByteSize(item.call);
    }

    if (this.config.debug) {
      console.log(`[Hone] Processing batch of ${batch.length} calls`);
    }

    try {
      await this.sendBatch(batchCalls);

      // Resolve all promises in the batch
      for (const item of batch) {
        item.resolve();
      }

      if (this.config.debug) {
        console.log(`[Hone] Successfully sent batch of ${batch.length} calls`);
      }
    } catch (error) {
      // Reject all promises in the batch
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      for (const item of batch) {
        item.reject(new Error(`Failed to send tracked call: ${errorMessage}`));
      }

      if (this.config.debug) {
        console.error(`[Hone] Failed to send batch: ${errorMessage}`);
      }
    }

    this.status = this.queue.length > 0 ? 'running' : 'idle';
  }

  /**
   * Send a batch of calls to the API with retry logic.
   */
  private async sendBatch(calls: PendingTrackedCall[]): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(calls);

        if (!response.ok) {
          // Check if we should retry
          if (
            RETRYABLE_STATUS_CODES.has(response.status) &&
            attempt < this.config.maxRetries
          ) {
            const backoffMs = calculateBackoffMs(attempt);
            if (this.config.debug) {
              console.warn(
                `[Hone] Request failed with status ${response.status}, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${this.config.maxRetries})`
              );
            }
            await sleep(backoffMs);
            continue;
          }

          // Non-retryable error or max retries reached
          const errorBody = await response.text().catch(() => 'Unknown error');
          throw new Error(
            `HTTP ${response.status}: ${response.statusText}. ${errorBody}`
          );
        }

        // Parse and validate response
        const result: TrackResponse = await response.json();

        if (!result.success) {
          throw new Error(
            `API returned failure: ${result.errors?.join(', ') ?? 'Unknown error'}`
          );
        }

        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Network errors - retry
        if (
          this.isNetworkError(error) &&
          attempt < this.config.maxRetries
        ) {
          const backoffMs = calculateBackoffMs(attempt);
          if (this.config.debug) {
            console.warn(
              `[Hone] Network error, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${this.config.maxRetries})`
            );
          }
          await sleep(backoffMs);
          continue;
        }

        // If not retryable or max retries reached, throw
        if (attempt >= this.config.maxRetries) {
          throw lastError;
        }
      }
    }

    throw lastError ?? new Error('Unknown error during batch send');
  }

  /**
   * Make the HTTP request to the tracking endpoint.
   */
  private async makeRequest(calls: PendingTrackedCall[]): Promise<Response> {
    const url = `${this.config.apiUrl}/v1/track`;
    const body = safeStringify({ calls });

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          'X-Project-ID': this.config.projectId,
        },
        body,
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if an error is a network-related error.
   */
  private isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const networkErrorIndicators = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      'EHOSTUNREACH',
      'network',
      'fetch',
      'abort',
    ];

    const errorString = error.message.toLowerCase();
    return networkErrorIndicators.some(
      (indicator) =>
        errorString.includes(indicator.toLowerCase()) ||
        error.name.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  /**
   * Manually flush all pending calls.
   * Returns when all pending calls have been sent.
   */
  async flush(): Promise<void> {
    // Wait for any pending flush to complete
    if (this.pendingFlush) {
      await this.pendingFlush;
    }

    // Clear the timer to prevent overlapping flushes
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Process remaining items
    while (this.queue.length > 0) {
      await this.processQueue();
    }
  }

  /**
   * Gracefully shutdown the processor.
   * Flushes remaining calls and prevents new enqueues.
   */
  async shutdown(): Promise<void> {
    if (this.config.debug) {
      console.log('[Hone] Shutting down background processor');
    }

    this.status = 'shutdown';

    // Clear the timer
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining calls
    await this.flush();

    if (this.config.debug) {
      console.log('[Hone] Background processor shutdown complete');
    }
  }
}
