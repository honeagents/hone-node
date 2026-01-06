# @hone/sdk

**AI Experience Engineering Platform** - Track, evaluate, and improve your LLM applications.

Hone is an SDK-first evaluation platform that automatically tracks LLM calls, generates test cases from production failures, and helps non-technical users improve prompts.

## Installation

```bash
npm install @hone/sdk
# or
yarn add @hone/sdk
# or
pnpm add @hone/sdk
```

With optional provider integrations:

```bash
# OpenAI support
npm install @hone/sdk openai

# Anthropic support
npm install @hone/sdk @anthropic-ai/sdk
```

## Quick Start

### 1. Set your API key

```bash
export HONE_API_KEY=hone_xxx
```

### 2. Track your LLM calls

```typescript
import { traceable } from "@hone/sdk";
import OpenAI from "openai";

const openai = new OpenAI();

const myAgent = traceable(
  async (query: string) => {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: query }],
    });
    return response.choices[0].message.content;
  },
  { name: "my-agent" }
);

// Every call is now tracked automatically
const result = await myAgent("What is the capital of France?");
```

### 3. View your traces

Visit [https://honeagents.ai](https://honeagents.ai) to see your traced calls, detected agents, and evaluation results.

## Features

### Automatic Tracing with `traceable`

The `traceable` function wraps your functions to capture:
- Function inputs and outputs
- Execution time and latency
- Nested call hierarchies
- Errors and exceptions

```typescript
import { traceable } from "@hone/sdk";

const supportAgent = traceable(
  async (userMessage: string) => {
    const context = await retrieveContext(userMessage);
    const response = await generateResponse(userMessage, context);
    return response;
  },
  { name: "customer-support-agent" }
);

const retrieveContext = traceable(
  async (query: string) => {
    // RAG retrieval - becomes a child trace
    return vectorDb.search(query);
  },
  { name: "retrieve-context" }
);

const generateResponse = traceable(
  async (query: string, context: string) => {
    // LLM generation - becomes a child trace
    return llm.generate(query, context);
  },
  { name: "generate-response" }
);
```

### Auto-Instrumentation with Wrappers

Wrap your LLM clients for automatic tracing without `traceable`:

```typescript
import { wrapOpenAI } from "@hone/sdk/wrappers";
import OpenAI from "openai";

// Wrap the OpenAI client
const client = wrapOpenAI(new OpenAI());

// All calls are now traced automatically
const response = await client.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello!" }],
});
```

### Manual Client Usage

For more control, use the Client directly:

```typescript
import { Client } from "@hone/sdk";

const client = new Client();

// Create feedback
await client.createFeedback({
  runId: "...",
  key: "user_satisfaction",
  score: 0.9,
  comment: "User seemed happy with the response",
});
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HONE_API_KEY` | Your Hone API key | Required |
| `HONE_ENDPOINT` | API endpoint URL | `https://api.honeagents.ai` |
| `HONE_PROJECT` | Project name | `default` |
| `HONE_TRACING` | Enable tracing | `true` |

### Migration from LangSmith

@hone/sdk is fully compatible with LangSmith environment variables for easy migration:

```bash
# These still work!
export LANGSMITH_API_KEY=ls_xxx
export LANGSMITH_PROJECT=my-project
```

Priority order: `HONE_*` > `LANGSMITH_*` > `LANGCHAIN_*`

## Advanced Usage

### Custom Metadata

```typescript
const myAgent = traceable(
  async (query: string) => {
    return llm.generate(query);
  },
  {
    name: "my-agent",
    metadata: { version: "1.0", environment: "production" },
    tags: ["customer-support", "production"],
  }
);
```

### Accessing Current Run

```typescript
import { getCurrentRunTree } from "@hone/sdk";

const myFunction = traceable(async () => {
  const runTree = getCurrentRunTree();
  if (runTree) {
    console.log("Current run ID:", runTree.id);
  }
});
```

## API Reference

### `traceable(fn, options)`

Wraps a function for automatic tracing.

```typescript
traceable(fn: Function, options?: {
  name?: string;           // Custom name (default: function name)
  runType?: string;        // Run type: "chain", "llm", "tool", etc.
  metadata?: object;       // Additional metadata
  tags?: string[];         // Categorization tags
  client?: Client;         // Custom client instance
  projectName?: string;    // Override project name
})
```

### `Client`

Main client for Hone API.

```typescript
const client = new Client({
  apiUrl?: string;    // API endpoint
  apiKey?: string;    // API key
});

// Methods
client.createRun(...)      // Create a new run
client.updateRun(...)      // Update/end a run
client.createFeedback(...) // Record evaluation feedback
client.createDataset(...)  // Create a test dataset
client.createExample(...)  // Add example to dataset
```

## TypeScript Support

@hone/sdk is written in TypeScript and provides full type definitions.

```typescript
import type { Run, Feedback, Dataset, Example } from "@hone/sdk";
```

## License

MIT License - see LICENSE file for details.

## Support

- Documentation: [https://docs.honeagents.ai](https://docs.honeagents.ai)
- Issues: [https://github.com/stone-pebble/hone-sdk/issues](https://github.com/stone-pebble/hone-sdk/issues)
- Email: support@honeagents.ai
