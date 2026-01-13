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
 * @returns
 */
export function getPromptNode(
  id: string,
  options: GetPromptOptions,
): PromptNode {
  const children: PromptNode[] = [];

  const simpleParams: SimpleParams = {};
  for (const [paramId, value] of Object.entries(options?.params || {})) {
    if (typeof value === "string") {
      simpleParams[paramId] = value;
    } else {
      children.push(getPromptNode(paramId, value));
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

    // Insert evaluated children into this prompt
    const result = insertParamsIntoPrompt(node.prompt, params);
    evaluated.set(node.id, result);
    return result;
  }

  return evaluate(node);
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
    rootId: node.id,
    map,
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
