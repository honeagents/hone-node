# Hone SDK (TypeScript)

**Last Updated:** 2026-01-09

**AI Experience Engineering Platform** - Track, evaluate, and improve your LLM applications.

Hone is an SDK-first evaluation platform that automatically tracks LLM calls, generates test cases from production failures, and helps non-technical users improve prompts.

## Installation

```bash
npm install hone-sdk
# or
yarn add hone-sdk
# or
pnpm add hone-sdk
```

With optional provider integrations:

```bash
# OpenAI support
npm install hone-sdk openai

# Anthropic support
npm install hone-sdk @anthropic-ai/sdk
```

## Quick Start

### 1. Set your API key

```bash
export HONE_API_KEY=hone_xxx
```

### 2. Track your LLM calls

```typescript
import { traceable } from "hone-sdk";
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

### Automatic Tracing

The `traceable` wrapper captures:
- Function inputs and outputs
- Execution time and latency
- Token usage and costs
- Nested call hierarchies
- Errors and exceptions

```typescript
import { traceable } from "hone-sdk";

const supportAgent = traceable(
  async (userMessage: string) => {
    // Nested calls are automatically traced
    const context = await retrieveContext(userMessage);
    const response = await generateResponse(userMessage, context);
    return response;
  },
  { name: "customer-support-agent" }
);

const retrieveContext = traceable(
  async (query: string) => {
    // RAG retrieval - becomes a child run
    return vectorDb.search(query);
  },
  { name: "retrieve-context", run_type: "retriever" }
);

const generateResponse = traceable(
  async (query: string, context: string) => {
    // LLM generation - becomes a child run
    return llm.generate(query, context);
  },
  { name: "generate-response", run_type: "llm" }
);
```

### Auto-Instrumentation

Wrap your LLM clients for automatic tracing without decorators:

```typescript
import { wrapOpenAI } from "hone-sdk/wrappers";
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
import { Client } from "hone-sdk";

const client = new Client();

// Create a run manually
const run = await client.createRun({
  name: "my-pipeline",
  run_type: "chain",
  inputs: { query: "Hello" },
});

// ... do work ...

// End the run
await client.updateRun(run.id, {
  outputs: { response: "Hi there!" },
  end_time: new Date().toISOString(),
});
```

### Feedback & Evaluation

Record evaluation scores for your runs:

```typescript
import { Client } from "hone-sdk";

const client = new Client();

// Record feedback
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

Hone SDK is fully compatible with LangSmith environment variables for easy migration:

```bash
# These still work!
export LANGSMITH_API_KEY=ls_xxx
export LANGSMITH_PROJECT=my-project
```

Priority order: `HONE_*` > `LANGSMITH_*` > `LANGCHAIN_*`

## Advanced Usage

### RunTree for Manual Hierarchy

```typescript
import { RunTree } from "hone-sdk";

const parentRun = new RunTree({
  name: "parent-operation",
  run_type: "chain",
  inputs: { data: "..." },
});

await parentRun.postRun();

// Create child runs
const childRun = await parentRun.createChild({
  name: "child-operation",
  run_type: "tool",
  inputs: { param: "..." },
});

await childRun.postRun();
// ... do work ...
await childRun.patchRun();

await parentRun.patchRun();
```

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

## API Reference

### `traceable(fn, options)`

Wrapper to automatically trace function calls.

```typescript
traceable(
  fn: (...args: any[]) => any,
  options?: {
    name?: string;           // Custom name (default: function name)
    run_type?: string;       // Run type: chain, llm, tool, etc.
    metadata?: object;       // Additional metadata
    tags?: string[];         // Categorization tags
    client?: Client;         // Custom client instance
    project_name?: string;   // Override project name
  }
)
```

### `Client`

Main client for Hone API.

```typescript
const client = new Client({
  apiUrl?: string;    // API endpoint
  apiKey?: string;    // API key
});

// Methods
await client.createRun({ ... });      // Create a new run
await client.updateRun(id, { ... });  // Update/end a run
await client.createFeedback({ ... }); // Record evaluation feedback
await client.createDataset({ ... });  // Create a test dataset
await client.createExample({ ... });  // Add example to dataset
```

## TypeScript Support

This package is written in TypeScript and includes full type definitions. All types are exported:

```typescript
import type {
  Run,
  RunCreate,
  Feedback,
  Dataset,
  Example,
  HoneClientConfig,
} from "hone-sdk";
```

## License

MIT License - see LICENSE file for details.

## Support

- Documentation: [https://docs.honeagents.ai](https://docs.honeagents.ai)
- Issues: [https://github.com/stone-pebble/hone-sdk/issues](https://github.com/stone-pebble/hone-sdk/issues)
- Email: support@honeagents.ai
