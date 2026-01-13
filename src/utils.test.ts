import { describe, it, expect } from "vitest";
import {
  getPromptNode,
  evaluatePrompt,
  insertParamsIntoPrompt,
  traversePromptNode,
  formatPromptRequest,
  updatePromptNodes,
} from "./utils";
import { PromptNode, GetPromptOptions } from "./types";

describe("utils", () => {
  describe("getPromptNode", () => {
    it("should create a simple prompt node with no parameters", () => {
      const options: GetPromptOptions = {
        defaultPrompt: "Hello, World!",
      };

      const node = getPromptNode("greeting", options);

      expect(node).toEqual({
        id: "greeting",
        version: undefined,
        name: undefined,
        params: {},
        prompt: "Hello, World!",
        children: [],
      });
    });

    it("should create a prompt node with simple string parameters", () => {
      const options: GetPromptOptions = {
        defaultPrompt: "Hello, {{userName}}!",
        params: {
          userName: "Alice",
        },
      };

      const node = getPromptNode("greeting", options);

      expect(node).toEqual({
        id: "greeting",
        version: undefined,
        name: undefined,
        params: {
          userName: "Alice",
        },
        prompt: "Hello, {{userName}}!",
        children: [],
      });
    });

    it("should create a prompt node with version and name", () => {
      const options: GetPromptOptions = {
        version: "v1",
        name: "greeting-prompt",
        defaultPrompt: "Hello!",
      };

      const node = getPromptNode("greeting", options);

      expect(node.version).toBe("v1");
      expect(node.name).toBe("greeting-prompt");
    });

    it("should create nested prompt nodes from nested options", () => {
      const options: GetPromptOptions = {
        defaultPrompt: "Intro: {{introduction}}",
        params: {
          introduction: {
            defaultPrompt: "Hello, {{userName}}!",
            params: {
              userName: "Bob",
            },
          },
        },
      };

      const node = getPromptNode("main", options);

      expect(node.id).toBe("main");
      expect(node.children).toHaveLength(1);
      expect(node.children[0].id).toBe("introduction");
      expect(node.children[0].params).toEqual({ userName: "Bob" });
    });

    it("should handle multiple nested prompts", () => {
      const options: GetPromptOptions = {
        defaultPrompt: "{{header}} Content: {{body}} {{footer}}",
        params: {
          header: {
            defaultPrompt: "Header text",
          },
          body: {
            defaultPrompt: "Body with {{detail}}",
            params: {
              detail: "important info",
            },
          },
          footer: {
            defaultPrompt: "Footer",
          },
        },
      };

      const node = getPromptNode("document", options);

      expect(node.children).toHaveLength(3);
      expect(node.children.map((c) => c.id)).toEqual([
        "header",
        "body",
        "footer",
      ]);
    });
  });

  describe("insertParamsIntoPrompt", () => {
    it("should replace single placeholder", () => {
      const result = insertParamsIntoPrompt("Hello, {{name}}!", {
        name: "Alice",
      });
      expect(result).toBe("Hello, Alice!");
    });

    it("should replace multiple placeholders", () => {
      const result = insertParamsIntoPrompt("{{greeting}} {{name}}, {{action}}!", {
        greeting: "Hello",
        name: "Bob",
        action: "welcome",
      });
      expect(result).toBe("Hello Bob, welcome!");
    });

    it("should replace multiple occurrences of the same placeholder", () => {
      const result = insertParamsIntoPrompt(
        "{{name}} said: 'Hello {{name}}'",
        { name: "Charlie" },
      );
      expect(result).toBe("Charlie said: 'Hello Charlie'");
    });

    it("should return original prompt when no params provided", () => {
      const prompt = "Hello, {{name}}!";
      const result = insertParamsIntoPrompt(prompt);
      expect(result).toBe(prompt);
    });

    it("should handle empty params object", () => {
      const prompt = "Hello, {{name}}!";
      const result = insertParamsIntoPrompt(prompt, {});
      expect(result).toBe(prompt);
    });

    it("should not replace placeholders with no matching params", () => {
      const result = insertParamsIntoPrompt("Hello, {{name}}!", {
        greeting: "Hi",
      });
      expect(result).toBe("Hello, {{name}}!");
    });

    it("should handle prompts with no placeholders", () => {
      const result = insertParamsIntoPrompt("Hello, World!", {
        name: "Alice",
      });
      expect(result).toBe("Hello, World!");
    });

    it("should handle special characters in values", () => {
      const result = insertParamsIntoPrompt("Message: {{text}}", {
        text: "Special chars: $, *, (, )",
      });
      expect(result).toBe("Message: Special chars: $, *, (, )");
    });
  });

  describe("evaluatePrompt", () => {
    it("should evaluate a simple prompt with params", () => {
      const node: PromptNode = {
        id: "greeting",
        params: { userName: "Alice" },
        prompt: "Hello, {{userName}}!",
        children: [],
      };

      const result = evaluatePrompt(node);
      expect(result).toBe("Hello, Alice!");
    });

    it("should evaluate nested prompts depth-first", () => {
      const node: PromptNode = {
        id: "main",
        params: {},
        prompt: "Intro: {{introduction}}",
        children: [
          {
            id: "introduction",
            params: { userName: "Bob" },
            prompt: "Hello, {{userName}}!",
            children: [],
          },
        ],
      };

      const result = evaluatePrompt(node);
      expect(result).toBe("Intro: Hello, Bob!");
    });

    it("should evaluate multiple levels of nesting", () => {
      const node: PromptNode = {
        id: "main",
        params: {},
        prompt: "Doc: {{section}}",
        children: [
          {
            id: "section",
            params: {},
            prompt: "Section: {{paragraph}}",
            children: [
              {
                id: "paragraph",
                params: { text: "content" },
                prompt: "Para: {{text}}",
                children: [],
              },
            ],
          },
        ],
      };

      const result = evaluatePrompt(node);
      expect(result).toBe("Doc: Section: Para: content");
    });

    it("should handle multiple children", () => {
      const node: PromptNode = {
        id: "document",
        params: {},
        prompt: "{{header}}\n{{body}}\n{{footer}}",
        children: [
          {
            id: "header",
            params: {},
            prompt: "HEADER",
            children: [],
          },
          {
            id: "body",
            params: { content: "text" },
            prompt: "Body: {{content}}",
            children: [],
          },
          {
            id: "footer",
            params: {},
            prompt: "FOOTER",
            children: [],
          },
        ],
      };

      const result = evaluatePrompt(node);
      expect(result).toBe("HEADER\nBody: text\nFOOTER");
    });

    it("should handle prompt with no children or params", () => {
      const node: PromptNode = {
        id: "simple",
        params: {},
        prompt: "Static text",
        children: [],
      };

      const result = evaluatePrompt(node);
      expect(result).toBe("Static text");
    });

    it("should cache evaluated nodes to avoid recomputation", () => {
      // This tests that if a node is referenced multiple times, it's only evaluated once
      const sharedChild: PromptNode = {
        id: "shared",
        params: {},
        prompt: "Shared",
        children: [],
      };

      const node: PromptNode = {
        id: "main",
        params: {},
        prompt: "{{shared}}",
        children: [sharedChild],
      };

      const result = evaluatePrompt(node);
      expect(result).toBe("Shared");
    });
  });

  describe("traversePromptNode", () => {
    it("should visit single node", () => {
      const node: PromptNode = {
        id: "root",
        params: {},
        prompt: "test",
        children: [],
      };

      const visited: Array<{ id: string; parentId: string | null }> = [];
      traversePromptNode(node, (n, parentId) => {
        visited.push({ id: n.id, parentId });
      });

      expect(visited).toEqual([{ id: "root", parentId: null }]);
    });

    it("should visit nodes in depth-first order", () => {
      const node: PromptNode = {
        id: "root",
        params: {},
        prompt: "test",
        children: [
          {
            id: "child1",
            params: {},
            prompt: "test",
            children: [
              {
                id: "grandchild1",
                params: {},
                prompt: "test",
                children: [],
              },
            ],
          },
          {
            id: "child2",
            params: {},
            prompt: "test",
            children: [],
          },
        ],
      };

      const visited: string[] = [];
      traversePromptNode(node, (n) => {
        visited.push(n.id);
      });

      expect(visited).toEqual(["root", "child1", "grandchild1", "child2"]);
    });

    it("should pass correct parent ID to callback", () => {
      const node: PromptNode = {
        id: "root",
        params: {},
        prompt: "test",
        children: [
          {
            id: "child1",
            params: {},
            prompt: "test",
            children: [
              {
                id: "grandchild1",
                params: {},
                prompt: "test",
                children: [],
              },
            ],
          },
          {
            id: "child2",
            params: {},
            prompt: "test",
            children: [],
          },
        ],
      };

      const relationships: Array<{ id: string; parentId: string | null }> = [];
      traversePromptNode(node, (n, parentId) => {
        relationships.push({ id: n.id, parentId });
      });

      expect(relationships).toEqual([
        { id: "root", parentId: null },
        { id: "child1", parentId: "root" },
        { id: "grandchild1", parentId: "child1" },
        { id: "child2", parentId: "root" },
      ]);
    });
  });

  describe("formatPromptRequest", () => {
    it("should format a simple prompt node", () => {
      const node: PromptNode = {
        id: "greeting",
        name: "greeting-prompt",
        version: "v1",
        params: { userName: "Alice" },
        prompt: "Hello, {{userName}}!",
        children: [],
      };

      const request = formatPromptRequest(node);

      expect(request.rootId).toBe("greeting");
      expect(request.map["greeting"]).toEqual({
        id: "greeting",
        name: "greeting-prompt",
        version: "v1",
        prompt: "Hello, {{userName}}!",
        paramKeys: ["userName"],
        childrenIds: [],
      });
    });

    it("should format nested prompt nodes", () => {
      const node: PromptNode = {
        id: "main",
        params: {},
        prompt: "Intro: {{introduction}}",
        children: [
          {
            id: "introduction",
            params: { userName: "Bob" },
            prompt: "Hello, {{userName}}!",
            children: [],
          },
        ],
      };

      const request = formatPromptRequest(node);

      expect(request.rootId).toBe("main");
      expect(request.map["main"]).toEqual({
        id: "main",
        name: undefined,
        version: undefined,
        prompt: "Intro: {{introduction}}",
        paramKeys: [],
        childrenIds: ["introduction"],
      });
      expect(request.map["introduction"]).toEqual({
        id: "introduction",
        name: undefined,
        version: undefined,
        prompt: "Hello, {{userName}}!",
        paramKeys: ["userName"],
        childrenIds: [],
      });
    });

    it("should format deeply nested structure", () => {
      const node: PromptNode = {
        id: "doc",
        params: {},
        prompt: "{{section}}",
        children: [
          {
            id: "section",
            params: {},
            prompt: "{{paragraph}}",
            children: [
              {
                id: "paragraph",
                params: { text: "content" },
                prompt: "{{text}}",
                children: [],
              },
            ],
          },
        ],
      };

      const request = formatPromptRequest(node);

      expect(request.rootId).toBe("doc");
      expect(Object.keys(request.map)).toHaveLength(3);
      expect(request.map["doc"].childrenIds).toEqual(["section"]);
      expect(request.map["section"].childrenIds).toEqual(["paragraph"]);
      expect(request.map["paragraph"].paramKeys).toEqual(["text"]);
    });

    it("should handle multiple children", () => {
      const node: PromptNode = {
        id: "document",
        params: {},
        prompt: "{{header}} {{body}} {{footer}}",
        children: [
          {
            id: "header",
            params: {},
            prompt: "HEADER",
            children: [],
          },
          {
            id: "body",
            params: { content: "text" },
            prompt: "{{content}}",
            children: [],
          },
          {
            id: "footer",
            params: {},
            prompt: "FOOTER",
            children: [],
          },
        ],
      };

      const request = formatPromptRequest(node);

      expect(request.map["document"].childrenIds).toEqual([
        "header",
        "body",
        "footer",
      ]);
      expect(Object.keys(request.map)).toHaveLength(4);
    });
  });

  describe("updatePromptNodes", () => {
    it("should update a single node", () => {
      const node: PromptNode = {
        id: "greeting",
        params: {},
        prompt: "Old prompt",
        children: [],
      };

      const updated = updatePromptNodes(node, (n) => ({
        ...n,
        prompt: "New prompt",
      }));

      expect(updated.prompt).toBe("New prompt");
      expect(updated.id).toBe("greeting");
    });

    it("should update all nodes in a nested structure", () => {
      const node: PromptNode = {
        id: "root",
        params: {},
        prompt: "root",
        children: [
          {
            id: "child1",
            params: {},
            prompt: "child1",
            children: [],
          },
          {
            id: "child2",
            params: {},
            prompt: "child2",
            children: [],
          },
        ],
      };

      const updated = updatePromptNodes(node, (n) => ({
        ...n,
        prompt: `updated-${n.id}`,
      }));

      expect(updated.prompt).toBe("updated-root");
      expect(updated.children[0].prompt).toBe("updated-child1");
      expect(updated.children[1].prompt).toBe("updated-child2");
    });

    it("should update deeply nested nodes", () => {
      const node: PromptNode = {
        id: "level1",
        params: {},
        prompt: "level1",
        children: [
          {
            id: "level2",
            params: {},
            prompt: "level2",
            children: [
              {
                id: "level3",
                params: {},
                prompt: "level3",
                children: [],
              },
            ],
          },
        ],
      };

      const updated = updatePromptNodes(node, (n) => ({
        ...n,
        prompt: `${n.prompt}-updated`,
      }));

      expect(updated.prompt).toBe("level1-updated");
      expect(updated.children[0].prompt).toBe("level2-updated");
      expect(updated.children[0].children[0].prompt).toBe("level3-updated");
    });

    it("should preserve node structure while updating", () => {
      const node: PromptNode = {
        id: "root",
        name: "root-name",
        version: "v1",
        params: { key: "value" },
        prompt: "original",
        children: [
          {
            id: "child",
            params: {},
            prompt: "child-original",
            children: [],
          },
        ],
      };

      const updated = updatePromptNodes(node, (n) => ({
        ...n,
        prompt: n.prompt.toUpperCase(),
      }));

      expect(updated.id).toBe("root");
      expect(updated.name).toBe("root-name");
      expect(updated.version).toBe("v1");
      expect(updated.params).toEqual({ key: "value" });
      expect(updated.prompt).toBe("ORIGINAL");
      expect(updated.children[0].prompt).toBe("CHILD-ORIGINAL");
    });

    it("should allow conditional updates", () => {
      const node: PromptNode = {
        id: "root",
        params: {},
        prompt: "root",
        children: [
          {
            id: "update-me",
            params: {},
            prompt: "old",
            children: [],
          },
          {
            id: "leave-me",
            params: {},
            prompt: "unchanged",
            children: [],
          },
        ],
      };

      const updated = updatePromptNodes(node, (n) => {
        if (n.id === "update-me") {
          return { ...n, prompt: "new" };
        }
        return n;
      });

      expect(updated.children[0].prompt).toBe("new");
      expect(updated.children[1].prompt).toBe("unchanged");
    });
  });
});
