import {
  GetAgentOptions,
  AgentNode,
  AgentRequest,
  AgentRequestItem,
  SimpleParams,
} from "./types";

/**
 * Constructs an AgentNode from the given id and GetAgentOptions.
 * Traverses nested agents recursively.
 *
 * @param id the unique identifier for the agent node
 * @param options the GetAgentOptions containing agent details and parameters
 * @param ancestorIds Set of ancestor IDs to detect circular references
 * @returns
 * @throws Error if a self-reference or circular reference is detected
 */
export function getAgentNode(
  id: string,
  options: GetAgentOptions,
  ancestorIds: Set<string> = new Set(),
): AgentNode {
  // Check for self-reference: if this agent's params contain a key matching its own id
  if (options?.params && id in options.params) {
    throw new Error(
      `Self-referencing agent detected: agent "${id}" cannot reference itself as a parameter`,
    );
  }

  // Check for circular reference: if this id is already in the ancestor chain
  if (ancestorIds.has(id)) {
    const path = Array.from(ancestorIds).concat(id).join(" -> ");
    throw new Error(`Circular agent reference detected: ${path}`);
  }

  const children: AgentNode[] = [];
  const newAncestorIds = new Set(ancestorIds).add(id);

  const simpleParams: SimpleParams = {};
  for (const [paramId, value] of Object.entries(options?.params || {})) {
    if (typeof value === "string") {
      simpleParams[paramId] = value;
    } else {
      children.push(getAgentNode(paramId, value, newAncestorIds));
    }
  }

  return {
    id,
    majorVersion: options.majorVersion,
    name: options.name,
    params: simpleParams,
    prompt: options.defaultPrompt,
    children,
    // Hyperparameters
    model: options.model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    topP: options.topP,
    frequencyPenalty: options.frequencyPenalty,
    presencePenalty: options.presencePenalty,
    stopSequences: options.stopSequences,
  };
}

/**
 * Evaluates an AgentNode by recursively inserting parameters and nested agents.
 *
 * @param node The root AgentNode to evaluate.
 * @returns The fully evaluated prompt string.
 * @throws Error if any placeholders in the prompt don't have corresponding parameter values
 */
export function evaluateAgent(node: AgentNode): string {
  const evaluated = new Map<string, string>();

  function evaluate(node: AgentNode): string {
    if (evaluated.has(node.id)) {
      return evaluated.get(node.id)!;
    }

    const params: SimpleParams = { ...node.params };

    // Evaluate all children first (depth-first)
    for (const child of node.children) {
      params[child.id] = evaluate(child);
    }

    // Validate that all placeholders have corresponding parameters
    validateAgentParams(node.prompt, params, node.id);

    // Insert evaluated children into this prompt
    const result = insertParamsIntoPrompt(node.prompt, params);
    evaluated.set(node.id, result);
    return result;
  }

  return evaluate(node);
}

/**
 * Validates that all placeholders in a prompt have corresponding parameter values.
 *
 * @param prompt The prompt template to validate
 * @param params The available parameters
 * @param nodeId The node ID for error messaging
 * @throws Error if any placeholders don't have corresponding parameters
 */
function validateAgentParams(
  prompt: string,
  params: SimpleParams,
  nodeId: string,
): void {
  // Extract all placeholders from the prompt
  const placeholderRegex = /\{\{(\w+)\}\}/g;
  const matches = prompt.matchAll(placeholderRegex);
  const missingParams: string[] = [];

  for (const match of matches) {
    const paramName = match[1];
    if (!(paramName in params)) {
      missingParams.push(paramName);
    }
  }

  if (missingParams.length > 0) {
    const uniqueMissing = [...new Set(missingParams)];
    throw new Error(
      `Missing parameter${uniqueMissing.length > 1 ? "s" : ""} in agent "${nodeId}": ${uniqueMissing.join(", ")}`,
    );
  }
}

/**
 * Inserts parameters into a prompt template.
 *
 * @param prompt The prompt template containing placeholders in the form `{{variableName}}`.
 * @param params An object mapping variable names to their replacement values.
 * @returns The prompt with all placeholders replaced by their corresponding values.
 */
export function insertParamsIntoPrompt(
  prompt: string,
  params?: SimpleParams,
): string {
  if (!params) return prompt;

  let result = prompt;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}

/**
 * Traverses an AgentNode tree and applies a callback to each node.
 */
export function traverseAgentNode(
  node: AgentNode,
  callback: (node: AgentNode, parentId: string | null) => void,
  parentId: string | null = null,
) {
  callback(node, parentId);
  for (const child of node.children) {
    traverseAgentNode(child, callback, node.id);
  }
}

/**
 * Formats an AgentNode into an AgentRequest suitable for the /sync_agents API.
 */
export function formatAgentRequest(node: AgentNode): AgentRequest {
  function formatNode(node: AgentNode): AgentRequestItem {
    const paramKeys = [
      ...Object.keys(node.params),
      ...node.children.map((child) => child.id),
    ];
    return {
      id: node.id,
      name: node.name,
      majorVersion: node.majorVersion,
      prompt: node.prompt,
      paramKeys,
      childrenIds: node.children.map((child) => child.id),
      // Hyperparameters
      model: node.model,
      temperature: node.temperature,
      maxTokens: node.maxTokens,
      topP: node.topP,
      frequencyPenalty: node.frequencyPenalty,
      presencePenalty: node.presencePenalty,
      stopSequences: node.stopSequences,
    };
  }

  const map: Record<string, AgentRequestItem> = {};

  traverseAgentNode(node, (currentNode) => {
    map[currentNode.id] = formatNode(currentNode);
  });
  return {
    agents: {
      rootId: node.id,
      map,
    },
  };
}

/**
 * Updates all nodes in an AgentNode tree using a callback function.
 */
export function updateAgentNodes(
  root: AgentNode,
  callback: (agentNode: AgentNode) => AgentNode,
): AgentNode {
  function updateNode(node: AgentNode): AgentNode {
    const updatedChildren = node.children.map(updateNode);
    const updatedNode = { ...node, children: updatedChildren };
    return callback(updatedNode);
  }
  return updateNode(root);
}

// ============================================================================
// Backwards Compatibility Aliases (deprecated)
// ============================================================================

/** @deprecated Use getAgentNode instead */
export const getPromptNode = getAgentNode;

/** @deprecated Use evaluateAgent instead */
export const evaluatePrompt = evaluateAgent;

/** @deprecated Use traverseAgentNode instead */
export const traversePromptNode = traverseAgentNode;

/** @deprecated Use formatAgentRequest instead */
export const formatPromptRequest = formatAgentRequest;

/** @deprecated Use updateAgentNodes instead */
export const updatePromptNodes = updateAgentNodes;
