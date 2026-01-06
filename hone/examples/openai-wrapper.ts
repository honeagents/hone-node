/**
 * OpenAI Auto-Instrumentation Example
 *
 * Demonstrates how to use the wrapOpenAI function to automatically
 * trace all OpenAI API calls without decorators.
 *
 * Requirements:
 *   npm install @hone/sdk openai
 */

import { wrapOpenAI } from "@hone/sdk/wrappers";
import OpenAI from "openai";

// Set your API keys
process.env.HONE_API_KEY = "hone_xxx"; // Replace with your Hone key
process.env.OPENAI_API_KEY = "sk-xxx"; // Replace with your OpenAI key
process.env.HONE_PROJECT = "openai-example";

async function main() {
  console.log("=== Hone OpenAI Auto-Instrumentation Example ===\n");

  // Create and wrap the OpenAI client
  // All subsequent API calls will be automatically traced
  const client = wrapOpenAI(new OpenAI());

  console.log("1. Simple chat completion:");
  const response = await client.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "What is 2 + 2?" },
    ],
    max_tokens: 50,
  });
  console.log(`   Response: ${response.choices[0].message.content}\n`);

  console.log("2. Chat completion with more context:");
  const response2 = await client.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a math tutor." },
      { role: "user", content: "Explain why 2 + 2 = 4" },
      {
        role: "assistant",
        content: "When you have 2 items and add 2 more...",
      },
      { role: "user", content: "Can you give a simpler explanation?" },
    ],
    max_tokens: 100,
  });
  console.log(`   Response: ${response2.choices[0].message.content}\n`);

  console.log("3. Streaming response:");
  const stream = await client.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "user", content: "Count from 1 to 5, one number per line." },
    ],
    max_tokens: 50,
    stream: true,
  });

  process.stdout.write("   Response: ");
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      process.stdout.write(content);
    }
  }
  console.log("\n");

  console.log("=== All examples completed! ===");
  console.log("Check your Hone dashboard to see the traced OpenAI calls.");
  console.log("Each call shows: model, tokens, latency, and full message history.");
}

main().catch(console.error);
