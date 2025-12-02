/**
 * Portions of this code adapted from LangSmith SDK
 * Copyright (c) 2023 LangChain
 * Licensed under MIT License
 * https://github.com/langchain-ai/langsmith-sdk
 */

import type { Hone } from './client.js';
import type { TrackOptions, AnyFunction } from './types.js';

/**
 * Create a track decorator factory bound to a specific Hone client instance.
 *
 * This allows creating decorators that can be used independently of the client.
 *
 * @param client - The Hone client instance to use for tracking
 * @returns A track decorator factory
 *
 * @example
 * ```typescript
 * const aix = new Hone('key', 'project');
 * const track = createTrackDecorator(aix);
 *
 * class MyService {
 *   @track({ name: 'chat' })
 *   async chat(message: string) { ... }
 * }
 * ```
 */
export function createTrackDecorator(
  client: Hone
): (options?: TrackOptions) => MethodDecorator {
  return (options?: TrackOptions): MethodDecorator => {
    return client.trackMethod(options);
  };
}

/**
 * Create a track wrapper factory bound to a specific Hone client instance.
 *
 * This allows creating wrappers that can be used independently of the client.
 *
 * @param client - The Hone client instance to use for tracking
 * @returns A track wrapper factory
 *
 * @example
 * ```typescript
 * const aix = new Hone('key', 'project');
 * const track = createTrackWrapper(aix);
 *
 * const trackedFn = track(myFunction, { name: 'myFunction' });
 * ```
 */
export function createTrackWrapper(
  client: Hone
): <T extends unknown[], R>(
  fn: AnyFunction<T, R>,
  options?: TrackOptions
) => (...args: T) => Promise<Awaited<R>> {
  return <T extends unknown[], R>(
    fn: AnyFunction<T, R>,
    options?: TrackOptions
  ) => {
    return client.track(fn, options);
  };
}

/**
 * Higher-order function that wraps a function with tracking.
 *
 * This is useful when you don't have access to the class decorator syntax.
 *
 * @param client - The Hone client instance
 * @param fn - The function to wrap
 * @param options - Optional tracking options
 * @returns The wrapped function
 *
 * @example
 * ```typescript
 * const myFunction = async (msg: string) => { ... };
 * const trackedFunction = withTracking(aix, myFunction, { name: 'my-fn' });
 * ```
 */
export function withTracking<T extends unknown[], R>(
  client: Hone,
  fn: AnyFunction<T, R>,
  options?: TrackOptions
): (...args: T) => Promise<Awaited<R>> {
  return client.track(fn, options);
}

/**
 * Type-safe decorator for tracking async functions.
 *
 * @param client - The Hone client instance
 * @param options - Optional tracking options
 * @returns A method decorator
 */
export function tracked(
  client: Hone,
  options?: TrackOptions
): MethodDecorator {
  return client.trackMethod(options);
}

/**
 * Decorator metadata storage for stage-3 decorators.
 * This provides support for the newer decorator proposal.
 */
interface DecoratorContext {
  kind: 'method' | 'getter' | 'setter' | 'accessor' | 'field' | 'class';
  name: string | symbol;
  static: boolean;
  private: boolean;
  access: {
    get?: () => unknown;
    set?: (value: unknown) => void;
    has?: (target: object) => boolean;
  };
  addInitializer?: (initializer: () => void) => void;
}

/**
 * Stage 3 decorator factory for tracking methods.
 *
 * This supports the new TC39 decorator proposal.
 * Use this if your TypeScript is configured for stage 3 decorators.
 *
 * @param client - The Hone client instance
 * @param options - Optional tracking options
 * @returns A stage 3 method decorator
 *
 * @example
 * ```typescript
 * class MyService {
 *   @trackMethod3(aix, { name: 'chat' })
 *   async chat(message: string) { ... }
 * }
 * ```
 */
export function trackMethod3(
  client: Hone,
  options?: TrackOptions
): <T extends unknown[], R>(
  target: AnyFunction<T, R>,
  context: DecoratorContext
) => AnyFunction<T, Promise<Awaited<R>>> | void {
  return <T extends unknown[], R>(
    target: AnyFunction<T, R>,
    context: DecoratorContext
  ): AnyFunction<T, Promise<Awaited<R>>> | void => {
    if (context.kind !== 'method') {
      throw new Error('trackMethod3 can only be applied to methods');
    }

    const functionName = options?.name ?? String(context.name) ?? 'anonymous';
    return client.track(target, {
      ...options,
      name: functionName,
    });
  };
}

/**
 * Create a tracked version of an entire class's methods.
 *
 * @param client - The Hone client instance
 * @param methodFilter - Optional filter function to select which methods to track
 * @returns A class decorator
 *
 * @example
 * ```typescript
 * @trackClass(aix)
 * class MyService {
 *   async chat(message: string) { ... }  // This will be tracked
 *   async process(data: object) { ... }  // This will be tracked
 * }
 * ```
 */
export function trackClass<TClass extends new (...args: unknown[]) => object>(
  client: Hone,
  methodFilter?: (methodName: string) => boolean
): (target: TClass) => TClass {
  return (target: TClass): TClass => {
    const prototype = target.prototype as Record<string, unknown>;
    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      (name) =>
        name !== 'constructor' &&
        typeof prototype[name] === 'function' &&
        (methodFilter ? methodFilter(name) : true)
    );

    for (const methodName of methodNames) {
      const originalMethod = prototype[methodName] as (...args: unknown[]) => unknown;
      const trackedMethod = client.track(originalMethod, { name: methodName });

      Object.defineProperty(prototype, methodName, {
        value: function (this: unknown, ...args: unknown[]) {
          return trackedMethod.apply(this, args);
        },
        writable: true,
        enumerable: false,
        configurable: true,
      });
    }

    return target;
  };
}

/**
 * Utility type to ensure a function returns a Promise.
 */
export type Promisify<T> = T extends Promise<unknown> ? T : Promise<T>;

/**
 * Type for a tracked function.
 */
export type TrackedFunction<T extends unknown[], R> = (
  ...args: T
) => Promise<Awaited<R>>;
