/**
 * Test script for Hone TypeScript SDK.
 * Run the mock server first: cd ../sdk && uvicorn test_server:app --port 8000
 * Then run this: npx tsx test-sdk.ts
 */

// Configure environment before importing SDK
process.env.HONE_ENDPOINT = "http://localhost:8000";
process.env.HONE_API_KEY = "test_key_123";
process.env.HONE_PROJECT = "test-project";
process.env.LANGSMITH_TRACING = "true";

import { traceable, Client, getApiUrl, getApiKey, VERSION } from "./src";

async function main() {
  console.log("=".repeat(60));
  console.log("Hone TypeScript SDK Test");
  console.log("=".repeat(60));
  console.log(`VERSION: ${VERSION}`);
  console.log(`HONE_ENDPOINT: ${process.env.HONE_ENDPOINT}`);
  console.log(`HONE_PROJECT: ${process.env.HONE_PROJECT}`);
  console.log(`Resolved API URL: ${getApiUrl()}`);
  console.log(`Resolved API Key: ${getApiKey() ? "***" : "not set"}`);
  console.log("=".repeat(60));

  // Test client creation
  console.log("\n=== Testing Client Directly ===");
  const client = new Client();
  console.log(`Client created successfully`);

  // Test basic traceable function
  console.log("\n=== Testing Basic Tracing ===");
  const simpleFunction = traceable(
    async (query: string): Promise<string> => {
      return `Response to: ${query}`;
    },
    { name: "simple-function" }
  );

  const result1 = await simpleFunction("Hello world");
  console.log(`Result: ${result1}`);

  // Test nested tracing
  console.log("\n=== Testing Nested Tracing ===");
  const childFunction = traceable(
    async (query: string): Promise<string> => {
      return `Child processed: ${query}`;
    },
    { name: "child-function" }
  );

  const parentFunction = traceable(
    async (query: string): Promise<{ parent_result: string }> => {
      const childResult = await childFunction(query);
      return { parent_result: `Processed: ${childResult}` };
    },
    { name: "parent-function" }
  );

  const result2 = await parentFunction("Test nested");
  console.log(`Result: ${JSON.stringify(result2)}`);

  // Wait for background uploads
  console.log("\n=== Waiting for background uploads ===");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("\nTest complete! Check mock server output for captured data.");
}

main().catch(console.error);
