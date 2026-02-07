import {
  GetAgentOptions,
  GetToolOptions,
  GetTextPromptOptions,
  AgentNode,
  ToolNode,
  TextPromptNode,
  EntityNode,
  EntityV2Request,
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
// Request Formatting
// =============================================================================

/**
 * Formats an EntityNode into an EntityV2Request suitable for the /api/evaluate API.
 * Uses nested structure with param values (not just keys).
 */
export function formatEntityV2Request(node: EntityNode): EntityV2Request {
  function formatNode(n: EntityNode): EntityV2Request {
    // Build params: string values + recursively formatted children
    const params: Record<string, string | EntityV2Request> = {};

    // Add string params
    for (const [key, value] of Object.entries(n.params)) {
      params[key] = value;
    }

    // Add children as nested entities
    for (const child of n.children) {
      params[child.id] = formatNode(child);
    }

    const request: EntityV2Request = {
      id: n.id,
      type: n.type,
      prompt: n.prompt,
      params: Object.keys(params).length > 0 ? params : undefined,
      majorVersion: n.majorVersion,
      name: n.name,
    };

    // Add data for agents (hyperparameters)
    if (n.type === "agent") {
      request.data = {
        model: n.model,
        provider: n.provider,
        temperature: n.temperature,
        maxTokens: n.maxTokens,
        topP: n.topP,
        frequencyPenalty: n.frequencyPenalty,
        presencePenalty: n.presencePenalty,
        stopSequences: n.stopSequences,
        tools: n.tools,
      };
    }

    return request;
  }

  return formatNode(node);
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

