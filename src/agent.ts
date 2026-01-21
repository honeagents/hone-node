import {
  GetAgentOptions,
  GetToolOptions,
  GetTextPromptOptions,
  AgentNode,
  ToolNode,
  TextPromptNode,
  EntityNode,
  AgentRequest,
  AgentRequestItem,
  EntityRequest,
  EntityRequestItem,
  SimpleParams,
  EntityType,
  ParamsValue,
} from "./types";

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a ParamsValue is GetAgentOptions
 */
export function isAgentOptions(value: ParamsValue): value is GetAgentOptions {
  return (
    typeof value === "object" &&
    value !== null &&
    "defaultPrompt" in value &&
    "model" in value &&
    "provider" in value
  );
}

/**
 * Type guard to check if a ParamsValue is GetToolOptions
 * Tools have defaultPrompt but NOT model/provider, and have a distinguishing property
 * We need to differentiate from text prompts - tools typically have more complex usage
 * For now, we'll use a convention: if it has NO extra properties beyond the base, it's a text prompt
 */
export function isToolOptions(value: ParamsValue): value is GetToolOptions {
  if (
    typeof value !== "object" ||
    value === null ||
    !("defaultPrompt" in value) ||
    "model" in value ||
    "provider" in value
  ) {
    return false;
  }
  // Tools are explicitly marked or have tool-specific properties
  // For backwards compatibility, treat options with only base props as text prompts
  // unless explicitly marked
  return "_type" in value && value._type === "tool";
}

/**
 * Type guard to check if a ParamsValue is GetTextPromptOptions
 * Text prompts are the simplest - just defaultPrompt and optional params/version
 */
export function isTextPromptOptions(value: ParamsValue): value is GetTextPromptOptions {
  return (
    typeof value === "object" &&
    value !== null &&
    "defaultPrompt" in value &&
    !("model" in value) &&
    !("provider" in value) &&
    !("_type" in value && value._type === "tool")
  );
}

// =============================================================================
// Node Construction
// =============================================================================

/**
 * Constructs an AgentNode from the given id and GetAgentOptions.
 * Traverses nested agents/tools recursively.
 *
 * @param id the unique identifier for the agent node
 * @param options the GetAgentOptions containing agent details and parameters
 * @param ancestorIds Set of ancestor IDs to detect circular references
 * @returns AgentNode
 * @throws Error if a self-reference or circular reference is detected
 */
export function getAgentNode(
  id: string,
  options: GetAgentOptions,
  ancestorIds: Set<string> = new Set()
): AgentNode {
  const node = getEntityNode(id, "agent", options, ancestorIds);
  return node as AgentNode;
}

/**
 * Constructs a ToolNode from the given id and GetToolOptions.
 * Traverses nested agents/tools recursively.
 *
 * @param id the unique identifier for the tool node
 * @param options the GetToolOptions containing tool details and parameters
 * @param ancestorIds Set of ancestor IDs to detect circular references
 * @returns ToolNode
 * @throws Error if a self-reference or circular reference is detected
 */
export function getToolNode(
  id: string,
  options: GetToolOptions,
  ancestorIds: Set<string> = new Set()
): ToolNode {
  const node = getEntityNode(id, "tool", options, ancestorIds);
  return node as ToolNode;
}

/**
 * Constructs a TextPromptNode from the given id and GetTextPromptOptions.
 * Traverses nested prompts recursively.
 *
 * @param id the unique identifier for the text prompt node
 * @param options the GetTextPromptOptions containing prompt details and parameters
 * @param ancestorIds Set of ancestor IDs to detect circular references
 * @returns TextPromptNode
 * @throws Error if a self-reference or circular reference is detected
 */
export function getTextPromptNode(
  id: string,
  options: GetTextPromptOptions,
  ancestorIds: Set<string> = new Set()
): TextPromptNode {
  const node = getEntityNode(id, "prompt", options, ancestorIds);
  return node as TextPromptNode;
}

/**
 * Internal: Constructs an EntityNode from the given id, type, and options.
 * Handles agents, tools, and text prompts.
 */
function getEntityNode(
  id: string,
  type: EntityType,
  options: GetAgentOptions | GetToolOptions | GetTextPromptOptions,
  ancestorIds: Set<string> = new Set()
): EntityNode {
  // Check for self-reference
  if (options?.params && id in options.params) {
    throw new Error(
      `Self-referencing ${type} detected: ${type} "${id}" cannot reference itself as a parameter`
    );
  }

  // Check for circular reference
  if (ancestorIds.has(id)) {
    const path = Array.from(ancestorIds).concat(id).join(" -> ");
    throw new Error(`Circular ${type} reference detected: ${path}`);
  }

  const children: EntityNode[] = [];
  const newAncestorIds = new Set(ancestorIds).add(id);
  const simpleParams: SimpleParams = {};

  for (const [paramId, value] of Object.entries(options?.params || {})) {
    if (typeof value === "string") {
      simpleParams[paramId] = value;
    } else if (isAgentOptions(value)) {
      children.push(getEntityNode(paramId, "agent", value, newAncestorIds));
    } else if (isToolOptions(value)) {
      children.push(getEntityNode(paramId, "tool", value, newAncestorIds));
    } else if (isTextPromptOptions(value)) {
      children.push(getEntityNode(paramId, "prompt", value, newAncestorIds));
    }
  }

  // Build the base node
  const node: EntityNode = {
    id,
    type,
    majorVersion: options.majorVersion,
    name: options.name,
    params: simpleParams,
    prompt: options.defaultPrompt,
    children,
  };

  // Add hyperparameters only for agents
  if (type === "agent" && isAgentOptions(options)) {
    node.model = options.model;
    node.provider = options.provider;
    node.temperature = options.temperature;
    node.maxTokens = options.maxTokens;
    node.topP = options.topP;
    node.frequencyPenalty = options.frequencyPenalty;
    node.presencePenalty = options.presencePenalty;
    node.stopSequences = options.stopSequences;
    node.tools = options.tools;
  }

  return node;
}

// =============================================================================
// Evaluation
// =============================================================================

/**
 * Evaluates an EntityNode by recursively inserting parameters and nested entities.
 *
 * @param node The root EntityNode to evaluate.
 * @returns The fully evaluated prompt string.
 * @throws Error if any placeholders in the prompt don't have corresponding parameter values
 */
export function evaluateEntity(node: EntityNode): string {
  const evaluated = new Map<string, string>();

  function evaluate(node: EntityNode): string {
    if (evaluated.has(node.id)) {
      return evaluated.get(node.id)!;
    }

    const params: SimpleParams = { ...node.params };

    // Evaluate all children first (depth-first)
    for (const child of node.children) {
      params[child.id] = evaluate(child);
    }

    // Validate that all placeholders have corresponding parameters
    validateEntityParams(node.prompt, params, node.id, node.type);

    // Insert evaluated children into this prompt
    const result = insertParamsIntoPrompt(node.prompt, params);
    evaluated.set(node.id, result);
    return result;
  }

  return evaluate(node);
}

/**
 * Evaluates an AgentNode (alias for evaluateEntity for backwards compatibility)
 */
export function evaluateAgent(node: AgentNode): string {
  return evaluateEntity(node);
}

/**
 * Evaluates a ToolNode (alias for evaluateEntity)
 */
export function evaluateTool(node: ToolNode): string {
  return evaluateEntity(node);
}

/**
 * Evaluates a TextPromptNode (alias for evaluateEntity)
 */
export function evaluateTextPrompt(node: TextPromptNode): string {
  return evaluateEntity(node);
}

/**
 * Validates that all placeholders in a prompt have corresponding parameter values.
 */
function validateEntityParams(
  prompt: string,
  params: SimpleParams,
  nodeId: string,
  type: EntityType
): void {
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
      `Missing parameter${uniqueMissing.length > 1 ? "s" : ""} in ${type} "${nodeId}": ${uniqueMissing.join(", ")}`
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
  params?: SimpleParams
): string {
  if (!params) return prompt;

  let result = prompt;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}

// =============================================================================
// Traversal
// =============================================================================

/**
 * Traverses an EntityNode tree and applies a callback to each node.
 */
export function traverseEntityNode(
  node: EntityNode,
  callback: (node: EntityNode, parentId: string | null) => void,
  parentId: string | null = null
) {
  callback(node, parentId);
  for (const child of node.children) {
    traverseEntityNode(child, callback, node.id);
  }
}

/**
 * Traverses an AgentNode tree (alias for backwards compatibility)
 */
export function traverseAgentNode(
  node: AgentNode,
  callback: (node: AgentNode, parentId: string | null) => void,
  parentId: string | null = null
) {
  traverseEntityNode(
    node,
    callback as (node: EntityNode, parentId: string | null) => void,
    parentId
  );
}

// =============================================================================
// Request Formatting
// =============================================================================

/**
 * Formats an EntityNode into an EntityRequest suitable for the /sync_entities API.
 */
export function formatEntityRequest(node: EntityNode): EntityRequest {
  function formatNode(node: EntityNode): EntityRequestItem {
    const paramKeys = [
      ...Object.keys(node.params),
      ...node.children.map((child) => child.id),
    ];
    return {
      id: node.id,
      type: node.type,
      name: node.name,
      majorVersion: node.majorVersion,
      prompt: node.prompt,
      paramKeys,
      childrenIds: node.children.map((child) => child.id),
      childrenTypes: node.children.map((child) => child.type),
      // Hyperparameters (only for agents)
      model: node.model,
      provider: node.provider,
      temperature: node.temperature,
      maxTokens: node.maxTokens,
      topP: node.topP,
      frequencyPenalty: node.frequencyPenalty,
      presencePenalty: node.presencePenalty,
      stopSequences: node.stopSequences,
      tools: node.tools,
    };
  }

  const map: Record<string, EntityRequestItem> = {};

  traverseEntityNode(node, (currentNode) => {
    map[currentNode.id] = formatNode(currentNode);
  });

  return {
    entities: {
      rootId: node.id,
      rootType: node.type,
      map,
    },
  };
}

/**
 * Formats an AgentNode into an AgentRequest suitable for the /sync_agents API.
 * (Backwards compatible format)
 */
export function formatAgentRequest(node: AgentNode): AgentRequest {
  function formatNode(node: AgentNode): AgentRequestItem {
    const paramKeys = [
      ...Object.keys(node.params),
      ...node.children.map((child) => child.id),
    ];
    return {
      id: node.id,
      type: node.type,
      name: node.name,
      majorVersion: node.majorVersion,
      prompt: node.prompt,
      paramKeys,
      childrenIds: node.children.map((child) => child.id),
      // Hyperparameters
      model: node.model,
      provider: node.provider,
      temperature: node.temperature,
      maxTokens: node.maxTokens,
      topP: node.topP,
      frequencyPenalty: node.frequencyPenalty,
      presencePenalty: node.presencePenalty,
      stopSequences: node.stopSequences,
      tools: node.tools,
    };
  }

  const map: Record<string, AgentRequestItem> = {};

  traverseAgentNode(node, (currentNode) => {
    map[currentNode.id] = formatNode(currentNode as AgentNode);
  });

  return {
    agents: {
      rootId: node.id,
      map,
    },
  };
}

// =============================================================================
// Node Updates
// =============================================================================

/**
 * Updates all nodes in an EntityNode tree using a callback function.
 */
export function updateEntityNodes(
  root: EntityNode,
  callback: (entityNode: EntityNode) => EntityNode
): EntityNode {
  function updateNode(node: EntityNode): EntityNode {
    const updatedChildren = node.children.map(updateNode);
    const updatedNode = { ...node, children: updatedChildren };
    return callback(updatedNode);
  }
  return updateNode(root);
}

/**
 * Updates all nodes in an AgentNode tree (alias for backwards compatibility)
 */
export function updateAgentNodes(
  root: AgentNode,
  callback: (agentNode: AgentNode) => AgentNode
): AgentNode {
  return updateEntityNodes(
    root,
    callback as (node: EntityNode) => EntityNode
  ) as AgentNode;
}

// =============================================================================
// Backwards Compatibility Aliases (deprecated)
// =============================================================================

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
