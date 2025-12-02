/**
 * Hone SDK - Track and evaluate your LLM calls automatically.
 *
 * @example
 * ```typescript
 * import { Hone } from '@aix/sdk';
 *
 * const aix = new Hone('hone_xxx', 'my-project');
 *
 * // Wrap functions for automatic tracking
 * const trackedChat = aix.track(async (message: string) => {
 *   return await openai.chat.completions.create({
 *     model: 'gpt-4',
 *     messages: [{ role: 'user', content: message }],
 *   });
 * }, { name: 'chat-completion' });
 *
 * // Use the tracked function
 * const response = await trackedChat('Hello, world!');
 *
 * // Flush before exit
 * await aix.shutdown();
 * ```
 *
 * @packageDocumentation
 */

// Main client
export { Hone } from './client.js';

// Types
export type {
  HoneOptions,
  TrackOptions,
  TrackedCall,
  PendingTrackedCall,
  TrackResponse,
  BatchTrackRequest,
  TrackableFunction,
  AsyncFunction,
  AnyFunction,
  ProcessorStatus,
  LLMInfo,
  ChatMessage,
  CompletionResponse,
} from './types.js';

// Decorators and wrappers
export {
  createTrackDecorator,
  createTrackWrapper,
  withTracking,
  tracked,
  trackMethod3,
  trackClass,
  type TrackedFunction,
  type Promisify,
} from './decorators.js';

// Utilities (exported for advanced use cases)
export {
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
  getEnvVar,
  isNodeEnvironment,
  isBrowserEnvironment,
  estimateByteSize,
} from './utils.js';

// Background processor (exported for advanced use cases)
export {
  BackgroundProcessor,
  type BackgroundProcessorConfig,
} from './background.js';

// Version
export const VERSION = '0.1.0';
