/**
 * Basic Tracing Example
 *
 * Demonstrates how to use the traceable function to automatically
 * track function calls with Hone.
 */

import { traceable, Client, getCurrentRunTree } from "@hone/sdk";

// Set your API key (in production, use environment variables)
process.env.HONE_API_KEY = "hone_xxx"; // Replace with your key
process.env.HONE_PROJECT = "basic-tracing-example";

// Simple traced function
const simpleFunction = traceable(
  (x: number, y: number): number => {
    return x + y;
  },
  { name: "simple-function" }
);

// Function with custom metadata
const functionWithMetadata = traceable(
  (a: number, b: number): number => {
    return a * b;
  },
  {
    name: "custom-name",
    tags: ["math", "example"],
    metadata: { version: "1.0" },
  }
);

// Nested traces - parent function
const nestedParent = traceable(
  async (query: string): Promise<string> => {
    // These nested calls create child runs in the trace
    const context = await retrieveContext(query);
    const response = await generateResponse(query, context);
    return response;
  },
  { name: "nested-parent", runType: "chain" }
);

// Child trace - retrieval
const retrieveContext = traceable(
  async (query: string): Promise<string> => {
    // In real code, this would query a vector database
    await sleep(100);
    return `Context for: ${query}`;
  },
  { name: "retrieve-context", runType: "retriever" }
);

// Child trace - generation
const generateResponse = traceable(
  async (query: string, context: string): Promise<string> => {
    // In real code, this would call an LLM
    await sleep(100);
    return `Response to '${query}' using '${context}'`;
  },
  { name: "generate-response", runType: "llm" }
);

// Function that demonstrates error tracking
const functionWithError = traceable(
  (shouldFail: boolean): string => {
    if (shouldFail) {
      throw new Error("This is an intentional error for demonstration");
    }
    return "Success!";
  },
  { name: "function-with-error" }
);

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("=== Hone Basic Tracing Example ===\n");

  // Example 1: Simple function tracing
  console.log("1. Simple function:");
  const result1 = simpleFunction(5, 3);
  console.log(`   simpleFunction(5, 3) = ${result1}\n`);

  // Example 2: Custom metadata
  console.log("2. Function with custom name and tags:");
  const result2 = functionWithMetadata(2.5, 4.0);
  console.log(`   functionWithMetadata(2.5, 4.0) = ${result2}\n`);

  // Example 3: Nested traces
  console.log("3. Nested trace hierarchy:");
  const result3 = await nestedParent("How do I reset my password?");
  console.log(`   nestedParent(...) = ${result3}\n`);

  // Example 4: Error tracking
  console.log("4. Error tracking:");
  try {
    functionWithError(true);
  } catch (e) {
    console.log(`   Caught expected error: ${(e as Error).message}\n`);
  }

  // Example 5: Using the client directly
  console.log("5. Direct client usage:");
  const client = new Client();
  console.log(`   Client initialized successfully!\n`);

  console.log("=== All examples completed! ===");
  console.log("Check your Hone dashboard to see the traces.");
}

main().catch(console.error);
