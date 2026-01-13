import {
  GetPromptOptions,
  PromptNode,
  PromptRequest,
  PromptRequestItem,
  SimpleParams,
} from "./types";

/**
 * Constructs a PromptNode from the given id and GetPromptOptions.
 * Traverses nested prompts recursively.
 *
 * @param id the unique identifier for the prompt node
 * @param options the GetPromptOptions containing prompt details and parameters
 * @param ancestorIds Set of ancestor IDs to detect circular references
 * @returns
 * @throws Error if a self-reference or circular reference is detected
 */
export function getPromptNode(
  id: string,
  options: GetPromptOptions,
  ancestorIds: Set<string> = new Set(),
): PromptNode {
  // Check for self-reference: if this prompt's params contain a key matching its own id
  if (options?.params && id in options.params) {
    throw new Error(
      `Self-referencing prompt detected: prompt "${id}" cannot reference itself as a parameter`,
    );
  }

  // Check for circular reference: if this id is already in the ancestor chain
  if (ancestorIds.has(id)) {
    const path = Array.from(ancestorIds).concat(id).join(" -> ");
    throw new Error(`Circular prompt reference detected: ${path}`);
  }

  const children: PromptNode[] = [];
  const newAncestorIds = new Set(ancestorIds).add(id);

  const simpleParams: SimpleParams = {};
  for (const [paramId, value] of Object.entries(options?.params || {})) {
    if (typeof value === "string") {
      simpleParams[paramId] = value;
    } else {
      children.push(getPromptNode(paramId, value, newAncestorIds));
    }
  }

  return {
    id,
    version: options.version,
    name: options.name,
    params: simpleParams,
    prompt: options.defaultPrompt,
    children,
  };
}

/**
 * Evaluates a PromptNode by recursively inserting parameters and nested prompts.
 *
 * @param node The root PromptNode to evaluate.
 * @returns The fully evaluated prompt string.
 * @throws Error if any placeholders in the prompt don't have corresponding parameter values
 */
export function evaluatePrompt(node: PromptNode): string {
  const evaluated = new Map<string, string>();

  function evaluate(node: PromptNode): string {
    if (evaluated.has(node.id)) {
      return evaluated.get(node.id)!;
    }

    const params: SimpleParams = { ...node.params };

    // Evaluate all children first (depth-first)
    for (const child of node.children) {
      params[child.id] = evaluate(child);
    }

    // Validate that all placeholders have corresponding parameters
    validatePromptParams(node.prompt, params, node.id);

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
function validatePromptParams(
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
      `Missing parameter${uniqueMissing.length > 1 ? "s" : ""} in prompt "${nodeId}": ${uniqueMissing.join(", ")}`,
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
 * Traverses a PromptNode tree and applies a callback to each node.
 */
export function traversePromptNode(
  node: PromptNode,
  callback: (node: PromptNode, parentId: string | null) => void,
  parentId: string | null = null,
) {
  callback(node, parentId);
  for (const child of node.children) {
    traversePromptNode(child, callback, node.id);
  }
}

/**
 * Formats a PromptNode into a PromptRequest suitable for the /prompts API.
 */
export function formatPromptRequest(node: PromptNode): PromptRequest {
  function formatNode(node: PromptNode): PromptRequestItem {
    const paramKeys = Object.keys(node.params);
    return {
      id: node.id,
      name: node.name,
      version: node.version,
      prompt: node.prompt,
      paramKeys,
      childrenIds: node.children.map((child) => child.id),
    };
  }

  const map: Record<string, PromptRequestItem> = {};

  traversePromptNode(node, (currentNode, parentId) => {
    map[currentNode.id] = formatNode(currentNode);
  });
  return {
    prompts: {
      rootId: node.id,
      map,
    },
  };
}

/**
 * Updates all nodes in a PromptNode tree using a callback function.
 */
export function updatePromptNodes(
  root: PromptNode,
  callback: (promptNode: PromptNode) => PromptNode,
): PromptNode {
  function updateNode(node: PromptNode): PromptNode {
    const updatedChildren = node.children.map(updateNode);
    const updatedNode = { ...node, children: updatedChildren };
    return callback(updatedNode);
  }
  return updateNode(root);
}
