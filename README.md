# Hone SDK (TypeScript)

The official TypeScript/JavaScript SDK for [Hone](https://honeagents.ai) - the AI Experience Engineering Platform for tracking and improving LLM applications.

## Installation

```bash
npm install @honeagents/hone
```

## Quick Start

```typescript
import { Hone, AIProvider } from "@honeagents/hone";

// Initialize the client
const hone = new Hone({
  apiKey: process.env.HONE_API_KEY!,
});

// Fetch an agent configuration
const agent = await hone.agent("customer-support", {
  model: "gpt-4o",
  provider: AIProvider.OpenAI,
  defaultPrompt: `You are a helpful customer support agent for {{companyName}}.

Be friendly, professional, and always try to resolve the customer's issue.`,
  params: {
    companyName: "Acme Corp",
  },
});

// Use the result with your LLM provider
console.log(agent.systemPrompt);
// => "You are a helpful customer support agent for Acme Corp..."
console.log(agent.model);
// => "gpt-4o"
console.log(agent.temperature);
// => 0.7 (or whatever is configured in Hone dashboard)
```

## Features

- **Agent Management**: Define and fetch agent configurations with system prompts and hyperparameters
- **Zero-Friction Tracking**: Track conversations by passing native provider formats directly - no conversion needed
- **Tool Definitions**: Manage tool/function descriptions for function calling
- **Text Prompts**: Reusable text templates that can be nested in agents or tools
- **Parameter Substitution**: Dynamic prompt templates with `{{variable}}` syntax
- **Nested Entities**: Compose prompts by nesting tools and prompts within agents
- **Graceful Fallbacks**: Falls back to local defaults when API is unavailable
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## API Reference

### Initialization

```typescript
import { Hone } from "@honeagents/hone";

const hone = new Hone({
  apiKey: "your-api-key", // Required
  baseUrl: "https://custom-url.com/api", // Optional, defaults to Hone API
  timeout: 5000, // Optional, defaults to 10000ms
});
```

### `hone.agent(id, options)`

Fetches an agent configuration by ID.

```typescript
const agent = await hone.agent("my-agent", {
  // Required
  model: "gpt-4o",
  provider: "openai", // or use AIProvider.OpenAI
  defaultPrompt: "You are a helpful assistant.",

  // Optional
  params: { userName: "Alice" },
  temperature: 0.7,
  maxTokens: 1000,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: [],
  tools: ["search", "calculator"],
  majorVersion: 1,
  name: "My Agent",
  extra: { customField: "value" }, // Custom data stored with the agent
});

// Returns AgentResult
console.log(agent.systemPrompt); // Evaluated prompt with params substituted
console.log(agent.model); // "gpt-4o"
console.log(agent.provider); // "openai"
console.log(agent.temperature); // number | null
console.log(agent.maxTokens); // number | null
console.log(agent.tools); // string[]
```

### `hone.tool(id, options)`

Fetches a tool definition by ID.

```typescript
const tool = await hone.tool("web-search", {
  defaultPrompt: "Search the web for: {{query}}",
  params: { query: "latest news" },
  majorVersion: 1,
});

// Returns ToolResult
console.log(tool.prompt); // "Search the web for: latest news"
```

### `hone.prompt(id, options)`

Fetches a reusable text prompt by ID.

```typescript
const prompt = await hone.prompt("tone-guidelines", {
  defaultPrompt: "Always be friendly and professional.",
  majorVersion: 1,
});

// Returns TextPromptResult
console.log(prompt.text); // "Always be friendly and professional."
```

### `hone.track(id, input, options)`

Track a conversation for analysis. Accepts either normalized messages or **provider-specific formats** for zero-friction tracking.

```typescript
// Normalized format (works with any provider)
await hone.track(
  "conversation-123",
  [
    { role: "user", content: "Hello!" },
    { role: "assistant", content: "Hi there! How can I help?" },
  ],
  { sessionId: "session-abc" }
);
```

See [Zero-Friction Tracking](#zero-friction-tracking) for provider-specific examples.

## Nesting Entities

You can compose complex prompts by nesting tools and prompts within agents:

```typescript
const agent = await hone.agent("complex-agent", {
  model: "gpt-4o",
  provider: "openai",
  defaultPrompt: `You are an assistant with the following guidelines:

{{guidelines}}

You have access to these tools:
- Search: {{searchTool}}
- Calculator: {{calcTool}}`,
  params: {
    guidelines: {
      defaultPrompt: "Be helpful, accurate, and concise.",
    },
    searchTool: {
      defaultPrompt: "Search the web for information.",
    },
    calcTool: {
      defaultPrompt: "Perform mathematical calculations.",
    },
  },
});
```

## Zero-Friction Tracking

The SDK supports **zero-friction tracking** - pass your messages and responses in the provider's native format without any conversion. The SDK normalizes everything internally.

### Why Zero-Friction?

Different LLM providers have different message formats:
- **OpenAI**: Messages with `role` and `content`, tool calls in `tool_calls` array
- **Anthropic**: Separate `system` parameter, content blocks instead of strings
- **Gemini**: Uses `contents` with `parts`, roles are `user`/`model`

Instead of manually converting between formats, just pass what you already have.

### OpenAI

```typescript
import OpenAI from "openai";
import { Hone } from "@honeagents/hone";

const openai = new OpenAI();
const hone = new Hone({ apiKey: process.env.HONE_API_KEY! });

// Your messages in OpenAI's native format
const messages: OpenAI.ChatCompletionMessageParam[] = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "What's the capital of France?" },
];

// Make the API call
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages,
});

// Zero-friction tracking - just pass what you have!
await hone.track(
  "my-conversation",
  {
    provider: "openai",
    messages,  // Your OpenAI messages array
    response,  // The raw ChatCompletion response
  },
  { sessionId: "session-123" }
);
```

### Anthropic

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { Hone } from "@honeagents/hone";

const anthropic = new Anthropic();
const hone = new Hone({ apiKey: process.env.HONE_API_KEY! });

// Anthropic has system prompt separate from messages
const systemPrompt = "You are a helpful assistant.";
const messages: Anthropic.MessageParam[] = [
  { role: "user", content: "What's the capital of Japan?" },
];

// Make the API call
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  system: systemPrompt,
  messages,
  max_tokens: 1024,
});

// Zero-friction tracking - include the system prompt
await hone.track(
  "my-conversation",
  {
    provider: "anthropic",
    messages,       // Your Anthropic messages array
    system: systemPrompt,  // Anthropic's separate system prompt
    response,       // The raw Message response
  },
  { sessionId: "session-123" }
);
```

### Google Gemini

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Hone } from "@honeagents/hone";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const hone = new Hone({ apiKey: process.env.HONE_API_KEY! });

// Gemini uses "contents" with "parts"
const systemInstruction = "You are a helpful assistant.";
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction,
});

const contents = [
  { role: "user" as const, parts: [{ text: "What's the capital of Brazil?" }] },
];

// Make the API call
const response = await model.generateContent({ contents });

// Zero-friction tracking
await hone.track(
  "my-conversation",
  {
    provider: "gemini",
    contents,              // Your Gemini contents array
    systemInstruction,     // Gemini's system instruction
    response,              // The raw GenerateContentResult
  },
  { sessionId: "session-123" }
);
```

### Multi-Turn Conversations

For multi-turn conversations, just keep adding to your messages array and track after each turn:

```typescript
// OpenAI example
const messages: OpenAI.ChatCompletionMessageParam[] = [
  { role: "system", content: agent.systemPrompt },
  { role: "user", content: "Hello!" },
];

// First turn
const response1 = await openai.chat.completions.create({ model: "gpt-4o", messages });
await hone.track("convo", { provider: "openai", messages, response: response1 }, { sessionId });

// Add assistant response and user follow-up
messages.push({ role: "assistant", content: response1.choices[0].message.content ?? "" });
messages.push({ role: "user", content: "Tell me more!" });

// Second turn
const response2 = await openai.chat.completions.create({ model: "gpt-4o", messages });
await hone.track("convo", { provider: "openai", messages, response: response2 }, { sessionId });
```

### With Tool Calls

Tool calls are automatically extracted and normalized:

```typescript
// OpenAI with tools
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages,
  tools: [{ type: "function", function: { name: "get_weather", ... } }],
});

// If the model made tool calls, they're automatically extracted
await hone.track("convo", { provider: "openai", messages, response }, { sessionId });

// After executing the tool, add the result and continue
messages.push(response.choices[0].message); // Contains tool_calls
messages.push({
  role: "tool",
  tool_call_id: response.choices[0].message.tool_calls![0].id,
  content: JSON.stringify({ temperature: 72 }),
});

const response2 = await openai.chat.completions.create({ model: "gpt-4o", messages });
await hone.track("convo", { provider: "openai", messages, response: response2 }, { sessionId });
```

### Supported Formats Summary

| Provider | Input Type | System Prompt | Response Type |
|----------|------------|---------------|---------------|
| OpenAI | `ChatCompletionMessageParam[]` | In messages array | `ChatCompletion` |
| Anthropic | `MessageParam[]` | Separate `system` param | `Message` |
| Gemini | `Content[]` | Separate `systemInstruction` | `GenerateContentResult` |

## Provider Constants

Use type-safe provider constants:

```typescript
import { AIProvider, isValidProvider, getProviderDisplayName } from "@honeagents/hone";

// Use enum values
const config = {
  provider: AIProvider.OpenAI, // "openai"
  model: "gpt-4o",
};

// Validate provider strings
if (isValidProvider(userInput)) {
  // userInput is typed as AIProviderValue
}

// Get display names
getProviderDisplayName("openai"); // "OpenAI"
getProviderDisplayName("amazon-bedrock"); // "Amazon Bedrock"
```

### Supported Providers

| Provider           | Value             | Display Name        |
| ------------------ | ----------------- | ------------------- |
| OpenAI             | `openai`          | OpenAI              |
| Anthropic          | `anthropic`       | Anthropic           |
| Google AI          | `google`          | Google AI           |

## Tool Tracking Helpers

Utilities for extracting messages from different LLM provider formats:

```typescript
import {
  extractOpenAIMessages,
  extractAnthropicMessages,
  extractGeminiMessages,
  createToolResultMessage,
  // Short aliases
  fromOpenAI,
  fromAnthropic,
  fromGemini,
  toolResult,
} from "@honeagents/hone";

// Extract messages from OpenAI response
const messages = extractOpenAIMessages(openaiResponse);

// Create a tool result message
const resultMessage = createToolResultMessage("tool-call-id", "result data");
```

## Environment Variables

| Variable        | Description                                |
| --------------- | ------------------------------------------ |
| `HONE_API_KEY`  | Your Hone API key                          |
| `HONE_API_URL`  | Custom API URL (optional, for development) |

## Error Handling

The SDK gracefully falls back to local defaults when the API is unavailable:

```typescript
const agent = await hone.agent("my-agent", {
  model: "gpt-4o",
  provider: "openai",
  defaultPrompt: "Fallback prompt if API fails",
});

// If API call fails, agent.systemPrompt will be "Fallback prompt if API fails"
// and hyperparameters will use the values from options
```

## TypeScript Support

The SDK is written in TypeScript and provides comprehensive type definitions:

```typescript
import type {
  // Client types
  HoneClient,
  HoneConfig,

  // Agent types
  AgentResult,
  GetAgentOptions,

  // Tool types
  ToolResult,
  GetToolOptions,

  // Prompt types
  TextPromptResult,
  GetTextPromptOptions,

  // Message types
  Message,
  ToolCall,

  // Tracking types (zero-friction)
  TrackInput,
  TrackOpenAIInput,
  TrackAnthropicInput,
  TrackGeminiInput,
  TrackConversationOptions,

  // Provider types
  AIProviderValue,
} from "@honeagents/hone";
```

### Generic Extra Data

You can type custom extra data stored with agents:

```typescript
type MyExtra = {
  customField: string;
  anotherField: number;
};

const agent = await hone.agent<MyExtra>("my-agent", {
  model: "gpt-4o",
  provider: "openai",
  defaultPrompt: "...",
  extra: {
    customField: "value",
    anotherField: 42,
  },
});

// agent.customField is typed as string
// agent.anotherField is typed as number
```

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Links

- [Hone Platform](https://honeagents.ai)
- [Documentation](https://docs.honeagents.ai)
- [GitHub Issues](https://github.com/honeagents/hone-node/issues)
