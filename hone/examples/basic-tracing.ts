/**
 * Hone SDK Example: Customer Support Agent
 *
 * This example demonstrates a realistic customer support chatbot that:
 * - Uses agentId for stable tracking across prompt changes
 * - Groups messages into conversation sessions
 * - Shows nested tracing with retrieval and generation steps
 */

import { traceable } from "@hone/sdk";

// Configuration (use environment variables in production)
process.env.HONE_API_KEY = "hone_xxx"; // Replace with your key
process.env.HONE_ENDPOINT = "http://localhost:3000"; // Your Hone endpoint

// =============================================================================
// Simulated LLM and Vector DB (replace with real implementations)
// =============================================================================

async function callLLM(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  // Simulate LLM latency
  await new Promise((r) => setTimeout(r, 100));

  const lastMessage = messages[messages.length - 1]?.content || "";

  // Simple mock responses based on keywords
  if (lastMessage.toLowerCase().includes("password")) {
    return "To reset your password, go to Settings > Security > Reset Password. You'll receive an email with a reset link.";
  }
  if (lastMessage.toLowerCase().includes("refund")) {
    return "I can help with your refund. Please provide your order number and I'll look into it right away.";
  }
  if (lastMessage.toLowerCase().includes("order")) {
    return "I found your order #12345. It was shipped yesterday and should arrive within 3-5 business days.";
  }
  return "I'm here to help! Could you please provide more details about your issue?";
}

async function searchKnowledgeBase(query: string): Promise<string[]> {
  // Simulate vector search latency
  await new Promise((r) => setTimeout(r, 50));

  // Mock knowledge base results
  return [
    "Password resets can be done via Settings > Security",
    "Refunds are processed within 5-7 business days",
    "Standard shipping takes 3-5 business days",
  ];
}

// =============================================================================
// Agent Components (traced functions)
// =============================================================================

/**
 * Retrieves relevant context from the knowledge base.
 */
const retrieveContext = traceable(
  async (query: string): Promise<string> => {
    const results = await searchKnowledgeBase(query);
    return results.join("\n");
  },
  {
    name: "retrieve-context",
    runType: "retriever",
  }
);

/**
 * Generates a response using the LLM.
 * The messages array includes the system prompt, which Hone uses for agent detection.
 */
const generateResponse = traceable(
  async (messages: Array<{ role: string; content: string }>): Promise<string> => {
    const systemPrompt = messages.find((m) => m.role === "system")?.content || "";
    return await callLLM(systemPrompt, messages);
  },
  {
    name: "generate-response",
    runType: "llm",
  }
);

/**
 * The main customer support agent.
 *
 * Key features:
 * - agentId: Tracks this agent across prompt changes (you can update the
 *   system prompt and it will still be recognized as the same agent)
 * - sessionId: Set via traceable config for conversation grouping
 */
function createCustomerSupportAgent(sessionId: string) {
  // Create a new traceable function with the session ID baked in
  return traceable(
    async (
      userMessage: string,
      conversationHistory: Array<{ role: string; content: string }>
    ): Promise<string> => {
      // The system prompt - Hone will detect this agent from this prompt
      // If you change this prompt but keep the same agentId, Hone will
      // track it as the same agent (useful for prompt versioning)
      const systemPrompt = `You are a helpful customer support agent for an e-commerce company.
Be friendly, concise, and solution-oriented. If you don't know something,
offer to escalate to a human agent.`;

      // Build full message history with system prompt
      const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: userMessage },
      ];

      // RAG: Retrieve relevant context and add to messages
      const context = await retrieveContext(userMessage);
      const messagesWithContext = [
        ...messages.slice(0, -1),
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${userMessage}`,
        },
      ];

      // Generate response
      const response = await generateResponse(messagesWithContext);

      return response;
    },
    {
      name: "customer-support-agent",
      agentId: "customer-support-v1", // Stable ID across prompt changes
      sessionId: sessionId, // Groups all calls in this conversation
      runType: "chain",
    }
  );
}

// =============================================================================
// Simulate a Customer Conversation
// =============================================================================

async function simulateConversation() {
  console.log("=== Hone SDK: Customer Support Agent Demo ===\n");

  // Each conversation gets a unique session ID
  // This groups all messages together for evaluation
  const sessionId = `session-${Date.now()}`;
  console.log(`Session ID: ${sessionId}\n`);

  // Create agent bound to this session
  const agent = createCustomerSupportAgent(sessionId);

  const conversationHistory: Array<{ role: string; content: string }> = [];

  // Helper to chat and update history
  async function chat(userMessage: string) {
    console.log(`Customer: ${userMessage}`);

    const response = await agent(userMessage, conversationHistory);

    // Update history for next turn
    conversationHistory.push({ role: "user", content: userMessage });
    conversationHistory.push({ role: "assistant", content: response });

    console.log(`Agent: ${response}\n`);
    return response;
  }

  // Simulate a multi-turn conversation
  await chat("Hi, I forgot my password and can't log in.");
  await chat("Thanks! Also, I placed an order last week. Can you check on it?");
  await chat("Great, that's all I needed. Thanks for your help!");

  console.log("=== Conversation Complete ===");
  console.log("\nCheck your Hone dashboard to see:");
  console.log("- The detected agent (customer-support-v1) with its system prompt");
  console.log("- The conversation session with all 3 messages grouped together");
  console.log("- Nested traces showing retrieval and generation steps");
  console.log("\nKey benefits:");
  console.log("- Change the system prompt and the agent stays tracked (via agentId)");
  console.log("- Session-based evals run once when the conversation goes inactive");
}

// Run the demo
simulateConversation().catch(console.error);
