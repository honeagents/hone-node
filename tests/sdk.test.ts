/**
 * Comprehensive tests for the AIX TypeScript SDK.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Import the SDK components
import { AIX } from '../src/client.js';
import {
  generateUUID,
  getCurrentTimestamp,
  getCurrentTimeMs,
  getElapsedMs,
  sleep,
  calculateBackoffMs,
  safeStringify,
  safeParse,
  extractLLMInfo,
  isPromise,
  isCompletionResponse,
  estimateByteSize,
} from '../src/utils.js';
import {
  createTrackWrapper,
  withTracking,
} from '../src/decorators.js';
import type { CompletionResponse } from '../src/types.js';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('AIX SDK', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default successful response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, trackedCount: 1 }),
      text: async () => '{"success": true, "trackedCount": 1}',
    } as Response);
  });

  afterEach(async () => {
    // Clean up any timers
    jest.useRealTimers();
  });

  describe('AIX Client', () => {
    test('constructor validates required parameters', () => {
      expect(() => new AIX('', 'project')).toThrow('apiKey is required');
      expect(() => new AIX('key', '')).toThrow('projectId is required');
      expect(() => new AIX(null as unknown as string, 'project')).toThrow(
        'apiKey is required'
      );
    });

    test('constructor accepts valid parameters', () => {
      const client = new AIX('test-api-key', 'test-project');
      expect(client).toBeInstanceOf(AIX);
    });

    test('constructor accepts custom options', () => {
      const client = new AIX('test-api-key', 'test-project', {
        apiUrl: 'https://custom.api.com',
        batchSize: 50,
        flushIntervalMs: 2000,
        maxRetries: 5,
        timeoutMs: 60000,
        debug: true,
      });
      expect(client).toBeInstanceOf(AIX);
    });
  });

  describe('track() wrapper', () => {
    test('track() captures function call data', async () => {
      const client = new AIX('test-key', 'test-project', {
        flushIntervalMs: 100,
      });

      const originalFn = async (message: string) => {
        return { response: `Hello, ${message}!` };
      };

      const trackedFn = client.track(originalFn, { name: 'greet' });
      await trackedFn('World');

      // Wait for flush
      await client.flush();

      // Check that fetch was called with the tracked data
      expect(mockFetch).toHaveBeenCalled();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/track');
      expect(options?.method).toBe('POST');

      const body = JSON.parse(options?.body as string);
      expect(body.calls).toHaveLength(1);
      expect(body.calls[0].functionName).toBe('greet');
      expect(body.calls[0].projectId).toBe('test-project');
      expect(body.calls[0].durationMs).toBeGreaterThanOrEqual(0);

      await client.shutdown();
    });

    test('track() returns original result', async () => {
      const client = new AIX('test-key', 'test-project');

      const originalFn = async (a: number, b: number) => {
        return a + b;
      };

      const trackedFn = client.track(originalFn, { name: 'add' });
      const result = await trackedFn(2, 3);

      expect(result).toBe(5);
      await client.shutdown();
    });

    test('track() works with sync functions', async () => {
      const client = new AIX('test-key', 'test-project');

      const syncFn = (x: number) => x * 2;
      const trackedFn = client.track(syncFn, { name: 'double' });

      const result = await trackedFn(5);
      expect(result).toBe(10);

      await client.shutdown();
    });

    test('track() captures errors', async () => {
      const client = new AIX('test-key', 'test-project', {
        flushIntervalMs: 100,
      });

      const failingFn = async () => {
        throw new Error('Test error');
      };

      const trackedFn = client.track(failingFn, { name: 'failing' });

      await expect(trackedFn()).rejects.toThrow('Test error');

      // Wait for flush
      await client.flush();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.calls[0].error).toBe('Test error');

      await client.shutdown();
    });

    test('track() extracts LLM info from OpenAI-style response', async () => {
      const client = new AIX('test-key', 'test-project', {
        flushIntervalMs: 100,
      });

      const llmFn = async () => {
        return {
          choices: [{ message: { role: 'assistant', content: 'Hello' } }],
          usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 },
          model: 'gpt-4',
        };
      };

      const trackedFn = client.track(llmFn, { name: 'llm-call' });
      await trackedFn();
      await client.flush();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.calls[0].tokensUsed).toBe(100);
      expect(body.calls[0].model).toBe('gpt-4');

      await client.shutdown();
    });

    test('track() includes metadata and tags', async () => {
      const client = new AIX('test-key', 'test-project', {
        flushIntervalMs: 100,
      });

      const fn = async () => 'result';
      const trackedFn = client.track(fn, {
        name: 'test',
        metadata: { version: '1.0', user: 'test-user' },
        tags: ['production', 'api'],
      });

      await trackedFn();
      await client.flush();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.calls[0].metadata).toEqual({ version: '1.0', user: 'test-user' });
      expect(body.calls[0].tags).toEqual(['production', 'api']);

      await client.shutdown();
    });
  });

  describe('Background Processor', () => {
    test('background processor batches calls', async () => {
      const client = new AIX('test-key', 'test-project', {
        batchSize: 5,
        flushIntervalMs: 10000, // Long interval to test batching
      });

      const fn = async (x: number) => x;
      const trackedFn = client.track(fn, { name: 'batch-test' });

      // Make 5 calls to trigger batch
      await Promise.all([
        trackedFn(1),
        trackedFn(2),
        trackedFn(3),
        trackedFn(4),
        trackedFn(5),
      ]);

      // Wait a bit for the batch to be sent
      await sleep(100);

      // Should have made one batch request
      expect(mockFetch).toHaveBeenCalled();
      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.calls.length).toBe(5);

      await client.shutdown();
    });

    test('flush() sends all pending calls', async () => {
      const client = new AIX('test-key', 'test-project', {
        batchSize: 100, // High batch size
        flushIntervalMs: 60000, // Long interval
      });

      const fn = async (x: number) => x;
      const trackedFn = client.track(fn, { name: 'flush-test' });

      // Make a few calls
      await trackedFn(1);
      await trackedFn(2);
      await trackedFn(3);

      // No flush should have happened yet
      expect(mockFetch).not.toHaveBeenCalled();

      // Manual flush
      await client.flush();

      // Now fetch should have been called
      expect(mockFetch).toHaveBeenCalled();
      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.calls.length).toBe(3);

      await client.shutdown();
    });

    test('shutdown() gracefully completes', async () => {
      const client = new AIX('test-key', 'test-project', {
        batchSize: 100,
        flushIntervalMs: 60000,
      });

      const fn = async (x: number) => x;
      const trackedFn = client.track(fn, { name: 'shutdown-test' });

      await trackedFn(1);
      await trackedFn(2);

      // Shutdown should flush all pending calls
      await client.shutdown();

      expect(mockFetch).toHaveBeenCalled();
      expect(client.isShutdownComplete()).toBe(true);
      expect(client.getQueueSize()).toBe(0);
    });
  });

  describe('Async Functions', () => {
    test('works with async functions', async () => {
      const client = new AIX('test-key', 'test-project');

      const asyncFn = async (ms: number) => {
        await sleep(ms);
        return `Waited ${ms}ms`;
      };

      const trackedFn = client.track(asyncFn, { name: 'async-wait' });
      const result = await trackedFn(10);

      expect(result).toBe('Waited 10ms');
      await client.shutdown();
    });

    test('tracks concurrent async calls', async () => {
      const client = new AIX('test-key', 'test-project', {
        flushIntervalMs: 100,
      });

      const asyncFn = async (id: number) => {
        await sleep(Math.random() * 10);
        return id;
      };

      const trackedFn = client.track(asyncFn, { name: 'concurrent' });

      // Run 10 concurrent calls
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) => trackedFn(i))
      );

      expect(results).toHaveLength(10);
      expect(results.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      await client.shutdown();
    });
  });

  describe('Utility Functions', () => {
    test('generateUUID creates valid UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();

      // UUID format check
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid1).toMatch(uuidRegex);
      expect(uuid2).toMatch(uuidRegex);

      // Uniqueness check
      expect(uuid1).not.toBe(uuid2);
    });

    test('getCurrentTimestamp returns ISO string', () => {
      const timestamp = getCurrentTimestamp();
      expect(() => new Date(timestamp)).not.toThrow();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('getElapsedMs calculates elapsed time', async () => {
      const start = getCurrentTimeMs();
      await sleep(50);
      const elapsed = getElapsedMs(start);
      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow for timer variance
      expect(elapsed).toBeLessThan(200);
    });

    test('calculateBackoffMs returns appropriate delays', () => {
      const delay0 = calculateBackoffMs(0);
      const delay1 = calculateBackoffMs(1);
      const delay5 = calculateBackoffMs(5);

      expect(delay0).toBeGreaterThanOrEqual(1000);
      expect(delay0).toBeLessThan(1200); // With jitter

      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay1).toBeLessThan(2400);

      // Max delay is 30000
      expect(delay5).toBeLessThanOrEqual(33000);
    });

    test('safeStringify handles circular references', () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj;

      const result = safeStringify(obj);
      expect(result).toContain('"a":1');
      expect(result).toContain('[Circular]');
    });

    test('safeStringify handles special types', () => {
      const obj = {
        date: new Date('2024-01-01'),
        bigint: BigInt(123),
        error: new Error('test'),
        fn: function testFn() {},
      };

      const result = safeStringify(obj);
      const parsed = JSON.parse(result);

      expect(parsed.date).toBe('2024-01-01T00:00:00.000Z');
      expect(parsed.bigint).toBe('123');
      expect(parsed.error).toHaveProperty('message', 'test');
      expect(parsed.fn).toBe('[Function: testFn]');
    });

    test('safeParse returns fallback on invalid JSON', () => {
      expect(safeParse('invalid', { default: true })).toEqual({ default: true });
      expect(safeParse('{"valid": true}', { default: true })).toEqual({
        valid: true,
      });
    });

    test('isPromise correctly identifies promises', () => {
      expect(isPromise(Promise.resolve())).toBe(true);
      expect(isPromise(new Promise(() => {}))).toBe(true);
      expect(isPromise({ then: () => {} })).toBe(true);

      expect(isPromise(null)).toBe(false);
      expect(isPromise(undefined)).toBe(false);
      expect(isPromise({})).toBe(false);
      expect(isPromise(123)).toBe(false);
    });

    test('isCompletionResponse identifies OpenAI responses', () => {
      const validResponse: CompletionResponse = {
        choices: [{ message: { role: 'assistant', content: 'Hello' } }],
        usage: { total_tokens: 10 },
        model: 'gpt-4',
      };

      expect(isCompletionResponse(validResponse)).toBe(true);
      expect(isCompletionResponse({ usage: {} })).toBe(true);
      expect(isCompletionResponse({ choices: [] })).toBe(true);

      expect(isCompletionResponse(null)).toBe(false);
      expect(isCompletionResponse({})).toBe(false);
      expect(isCompletionResponse('string')).toBe(false);
    });

    test('extractLLMInfo extracts token and model info', () => {
      const response: CompletionResponse = {
        choices: [{ message: { role: 'assistant', content: 'Hello' } }],
        usage: { total_tokens: 150, prompt_tokens: 50, completion_tokens: 100 },
        model: 'gpt-4-turbo',
      };

      const info = extractLLMInfo(response);
      expect(info.tokensUsed).toBe(150);
      expect(info.model).toBe('gpt-4-turbo');
    });

    test('estimateByteSize estimates object size', () => {
      const small = { a: 1 };
      const large = { data: 'x'.repeat(1000) };

      const smallSize = estimateByteSize(small);
      const largeSize = estimateByteSize(large);

      expect(smallSize).toBeLessThan(100);
      expect(largeSize).toBeGreaterThan(1000);
    });
  });

  describe('Decorator Utilities', () => {
    test('createTrackWrapper creates working wrappers', async () => {
      const client = new AIX('test-key', 'test-project');
      const track = createTrackWrapper(client);

      const originalFn = async (x: number) => x * 3;
      const trackedFn = track(originalFn, { name: 'wrapped' });

      const result = await trackedFn(4);
      expect(result).toBe(12);

      await client.shutdown();
    });

    test('withTracking wraps functions', async () => {
      const client = new AIX('test-key', 'test-project');

      const originalFn = async (a: number, b: number) => a - b;
      const trackedFn = withTracking(client, originalFn, { name: 'subtract' });

      const result = await trackedFn(10, 3);
      expect(result).toBe(7);

      await client.shutdown();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty input', async () => {
      const client = new AIX('test-key', 'test-project');
      const fn = async () => 'no input';
      const trackedFn = client.track(fn, { name: 'empty-input' });

      const result = await trackedFn();
      expect(result).toBe('no input');

      await client.shutdown();
    });

    test('handles null and undefined returns', async () => {
      const client = new AIX('test-key', 'test-project');

      const nullFn = async () => null;
      const undefinedFn = async () => undefined;

      const trackedNull = client.track(nullFn, { name: 'null-fn' });
      const trackedUndefined = client.track(undefinedFn, { name: 'undefined-fn' });

      expect(await trackedNull()).toBeNull();
      expect(await trackedUndefined()).toBeUndefined();

      await client.shutdown();
    });

    test('handles large payloads', async () => {
      const client = new AIX('test-key', 'test-project', {
        flushIntervalMs: 100,
      });

      const largeFn = async (data: string) => {
        return { received: data.length };
      };

      const trackedFn = client.track(largeFn, { name: 'large-payload' });
      const largeData = 'x'.repeat(10000);

      const result = await trackedFn(largeData);
      expect(result).toEqual({ received: 10000 });

      await client.flush();
      expect(mockFetch).toHaveBeenCalled();

      await client.shutdown();
    });

    test('shutdown prevents new tracking', async () => {
      const client = new AIX('test-key', 'test-project');
      const fn = async (x: number) => x;
      const trackedFn = client.track(fn, { name: 'post-shutdown' });

      await client.shutdown();

      // Should still execute but not track
      const result = await trackedFn(42);
      expect(result).toBe(42);
      expect(client.isShutdownComplete()).toBe(true);
    });

    test('handles API failures gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const client = new AIX('test-key', 'test-project', {
        maxRetries: 3,
        flushIntervalMs: 100,
      });

      const fn = async () => 'result';
      const trackedFn = client.track(fn, { name: 'failing-api' });

      // Should not throw - tracking failures are handled silently
      const result = await trackedFn();
      expect(result).toBe('result');

      await client.shutdown();
    });
  });
});
