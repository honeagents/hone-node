# @aix/sdk

TypeScript SDK for tracking and evaluating LLM calls with AIX.

## Installation

```bash
npm install @aix/sdk
```

## Quick Start

```typescript
import { AIX } from '@aix/sdk';

// Initialize the client
const aix = new AIX('your-api-key', 'your-project-id');

// Wrap your LLM function for automatic tracking
const trackedChat = aix.track(async (message: string) => {
  return await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: message }],
  });
}, { name: 'chat-completion' });

// Use the tracked function
const response = await trackedChat('Hello, world!');

// Flush before exit
await aix.shutdown();
```

## Features

- Automatic LLM call tracking
- Background batch processing
- Retry logic with exponential backoff
- Works in Node.js 18+ and modern browsers
- TypeScript-first with full type support

## API Reference

### AIX Client

```typescript
const aix = new AIX(apiKey: string, projectId: string, options?: AIXOptions);
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | string | `'https://api.hone.ai'` | API endpoint URL |
| `batchSize` | number | `100` | Max calls per batch |
| `flushIntervalMs` | number | `1000` | Auto-flush interval |
| `maxRetries` | number | `3` | Max retry attempts |
| `timeoutMs` | number | `30000` | Request timeout |
| `debug` | boolean | `false` | Enable debug logging |

### Methods

#### `track(fn, options?)`

Wrap a function for automatic tracking.

```typescript
const trackedFn = aix.track(originalFn, {
  name: 'my-function',
  metadata: { version: '1.0' },
  tags: ['production'],
});
```

#### `flush()`

Manually flush all pending calls.

```typescript
await aix.flush();
```

#### `shutdown()`

Gracefully shutdown the client.

```typescript
await aix.shutdown();
```

## Environment Variables

- `AIX_API_URL` - Override the default API URL
- `AIX_DEBUG` - Set to `true` to enable debug logging

## License

MIT
