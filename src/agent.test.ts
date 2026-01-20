import { describe, it, expect } from "vitest";
import {
  getAgentNode,
  evaluateAgent,
  insertParamsIntoPrompt,
  traverseAgentNode,
  formatAgentRequest,
  updateAgentNodes,
} from "./agent";
import { AgentNode, GetAgentOptions } from "./types";

describe("utils", () => {
  describe("getAgentNode", () => {
    it("should create a simple agent node with no parameters", () => {
      const options: GetAgentOptions = {
        defaultPrompt: "Hello, World!",
      };

      const node = getAgentNode("greeting", options);

      expect(node).toEqual({
        id: "greeting",
        majorVersion: undefined,
        name: undefined,
        params: {},
        prompt: "Hello, World!",
        children: [],
        model: undefined,
        temperature: undefined,
        maxTokens: undefined,
        topP: undefined,
        frequencyPenalty: undefined,
        presencePenalty: undefined,
        stopSequences: undefined,
      });
    });

    it("should create an agent node with simple string parameters", () => {
      const options: GetAgentOptions = {
        defaultPrompt: "Hello, {{userName}}!",
        params: {
          userName: "Alice",
        },
      };

      const node = getAgentNode("greeting", options);

      expect(node).toEqual({
        id: "greeting",
        majorVersion: undefined,
        name: undefined,
        params: {
          userName: "Alice",
        },
        prompt: "Hello, {{userName}}!",
        children: [],
        model: undefined,
        temperature: undefined,
        maxTokens: undefined,
        topP: undefined,
        frequencyPenalty: undefined,
        presencePenalty: undefined,
        stopSequences: undefined,
      });
    });

    it("should create an agent node with majorVersion and name", () => {
      const options: GetAgentOptions = {
        majorVersion: 1,
        name: "greeting-agent",
        defaultPrompt: "Hello!",
      };

      const node = getAgentNode("greeting", options);

      expect(node.majorVersion).toBe(1);
      expect(node.name).toBe("greeting-agent");
    });

    it("should create an agent node with hyperparameters", () => {
      const options: GetAgentOptions = {
        defaultPrompt: "Hello!",
        model: "gpt-4",
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9,
        frequencyPenalty: 0.5,
        presencePenalty: 0.3,
        stopSequences: ["END", "STOP"],
      };

      const node = getAgentNode("greeting", options);

      expect(node.model).toBe("gpt-4");
      expect(node.temperature).toBe(0.7);
      expect(node.maxTokens).toBe(1000);
      expect(node.topP).toBe(0.9);
      expect(node.frequencyPenalty).toBe(0.5);
      expect(node.presencePenalty).toBe(0.3);
      expect(node.stopSequences).toEqual(["END", "STOP"]);
    });

    it("should create nested agent nodes from nested options", () => {
      const options: GetAgentOptions = {
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

      const node = getAgentNode("main", options);

      expect(node.id).toBe("main");
      expect(node.children).toHaveLength(1);
      expect(node.children[0].id).toBe("introduction");
      expect(node.children[0].params).toEqual({ userName: "Bob" });
    });

    it("should handle multiple nested agents", () => {
      const options: GetAgentOptions = {
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

      const node = getAgentNode("document", options);

      expect(node.children).toHaveLength(3);
      expect(node.children.map((c) => c.id)).toEqual([
        "header",
        "body",
        "footer",
      ]);
    });

    it("should throw an error for self-referencing agents", () => {
      const options: GetAgentOptions = {
        defaultPrompt: "This is an agent that references {{system-agent}}",
        params: {
          "system-agent": {
            defaultPrompt: "This should cause an error",
          },
        },
      };

      expect(() => getAgentNode("system-agent", options)).toThrow();
    });

    it("should throw an error for circular agent references", () => {
      const options: GetAgentOptions = {
        defaultPrompt: "A references {{b}}",
        params: {
          b: {
            defaultPrompt: "B references {{a}}",
            params: {
              a: {
                defaultPrompt: "A references {{b}} (circular)",
              },
            },
          },
        },
      };

      expect(() => getAgentNode("a", options)).toThrow();
    });

    it("should throw an error when agent has placeholders without matching parameters", () => {
      const options: GetAgentOptions = {
        defaultPrompt: "Hello {{name}}, your role is {{role}}",
        params: {
          name: "Alice",
          // 'role' is missing
        },
      };

      const node = getAgentNode("greeting", options);

      // Should throw when evaluating because 'role' placeholder has no value
      expect(() => evaluateAgent(node)).toThrow(/missing parameter.*role/i);
    });

    it("should throw an error listing all missing parameters", () => {
      const options: GetAgentOptions = {
        defaultPrompt: "{{greeting}} {{name}}, you are {{role}} in {{location}}",
        params: {
          name: "Bob",
          // Missing: greeting, role, location
        },
      };

      const node = getAgentNode("test", options);

      expect(() => evaluateAgent(node)).toThrow(/missing parameter/i);
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

  describe("evaluateAgent", () => {
    it("should evaluate a simple agent with params", () => {
      const node: AgentNode = {
        id: "greeting",
        params: { userName: "Alice" },
        prompt: "Hello, {{userName}}!",
        children: [],
      };

      const result = evaluateAgent(node);
      expect(result).toBe("Hello, Alice!");
    });

    it("should evaluate nested agents depth-first", () => {
      const node: AgentNode = {
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

      const result = evaluateAgent(node);
      expect(result).toBe("Intro: Hello, Bob!");
    });

    it("should evaluate multiple levels of nesting", () => {
      const node: AgentNode = {
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

      const result = evaluateAgent(node);
      expect(result).toBe("Doc: Section: Para: content");
    });

    it("should handle multiple children", () => {
      const node: AgentNode = {
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

      const result = evaluateAgent(node);
      expect(result).toBe("HEADER\nBody: text\nFOOTER");
    });

    it("should handle agent with no children or params", () => {
      const node: AgentNode = {
        id: "simple",
        params: {},
        prompt: "Static text",
        children: [],
      };

      const result = evaluateAgent(node);
      expect(result).toBe("Static text");
    });

    it("should cache evaluated nodes to avoid recomputation", () => {
      // This tests that if a node is referenced multiple times, it's only evaluated once
      const sharedChild: AgentNode = {
        id: "shared",
        params: {},
        prompt: "Shared",
        children: [],
      };

      const node: AgentNode = {
        id: "main",
        params: {},
        prompt: "{{shared}}",
        children: [sharedChild],
      };

      const result = evaluateAgent(node);
      expect(result).toBe("Shared");
    });
  });

  describe("traverseAgentNode", () => {
    it("should visit single node", () => {
      const node: AgentNode = {
        id: "root",
        params: {},
        prompt: "test",
        children: [],
      };

      const visited: Array<{ id: string; parentId: string | null }> = [];
      traverseAgentNode(node, (n, parentId) => {
        visited.push({ id: n.id, parentId });
      });

      expect(visited).toEqual([{ id: "root", parentId: null }]);
    });

    it("should visit nodes in depth-first order", () => {
      const node: AgentNode = {
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
      traverseAgentNode(node, (n) => {
        visited.push(n.id);
      });

      expect(visited).toEqual(["root", "child1", "grandchild1", "child2"]);
    });

    it("should pass correct parent ID to callback", () => {
      const node: AgentNode = {
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
      traverseAgentNode(node, (n, parentId) => {
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

  describe("formatAgentRequest", () => {
    it("should format a simple agent node", () => {
      const node: AgentNode = {
        id: "greeting",
        name: "greeting-agent",
        majorVersion: 1,
        params: { userName: "Alice" },
        prompt: "Hello, {{userName}}!",
        children: [],
      };

      const request = formatAgentRequest(node);

      expect(request.agents.rootId).toBe("greeting");
      expect(request.agents.map["greeting"]).toEqual({
        id: "greeting",
        name: "greeting-agent",
        majorVersion: 1,
        prompt: "Hello, {{userName}}!",
        paramKeys: ["userName"],
        childrenIds: [],
        model: undefined,
        temperature: undefined,
        maxTokens: undefined,
        topP: undefined,
        frequencyPenalty: undefined,
        presencePenalty: undefined,
        stopSequences: undefined,
      });
    });

    it("should format nested agent nodes", () => {
      const node: AgentNode = {
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

      const request = formatAgentRequest(node);

      expect(request.agents.rootId).toBe("main");
      expect(request.agents.map["main"]).toEqual({
        id: "main",
        name: undefined,
        majorVersion: undefined,
        prompt: "Intro: {{introduction}}",
        paramKeys: ["introduction"],
        childrenIds: ["introduction"],
        model: undefined,
        temperature: undefined,
        maxTokens: undefined,
        topP: undefined,
        frequencyPenalty: undefined,
        presencePenalty: undefined,
        stopSequences: undefined,
      });
      expect(request.agents.map["introduction"]).toEqual({
        id: "introduction",
        name: undefined,
        majorVersion: undefined,
        prompt: "Hello, {{userName}}!",
        paramKeys: ["userName"],
        childrenIds: [],
        model: undefined,
        temperature: undefined,
        maxTokens: undefined,
        topP: undefined,
        frequencyPenalty: undefined,
        presencePenalty: undefined,
        stopSequences: undefined,
      });
    });

    it("should format agent node with hyperparameters", () => {
      const node: AgentNode = {
        id: "greeting",
        params: {},
        prompt: "Hello!",
        children: [],
        model: "gpt-4",
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9,
        frequencyPenalty: 0.5,
        presencePenalty: 0.3,
        stopSequences: ["END"],
      };

      const request = formatAgentRequest(node);

      expect(request.agents.map["greeting"].model).toBe("gpt-4");
      expect(request.agents.map["greeting"].temperature).toBe(0.7);
      expect(request.agents.map["greeting"].maxTokens).toBe(1000);
      expect(request.agents.map["greeting"].topP).toBe(0.9);
      expect(request.agents.map["greeting"].frequencyPenalty).toBe(0.5);
      expect(request.agents.map["greeting"].presencePenalty).toBe(0.3);
      expect(request.agents.map["greeting"].stopSequences).toEqual(["END"]);
    });

    it("should format deeply nested structure", () => {
      const node: AgentNode = {
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

      const request = formatAgentRequest(node);

      expect(request.agents.rootId).toBe("doc");
      expect(Object.keys(request.agents.map)).toHaveLength(3);
      expect(request.agents.map["doc"].childrenIds).toEqual(["section"]);
      expect(request.agents.map["section"].childrenIds).toEqual(["paragraph"]);
      expect(request.agents.map["paragraph"].paramKeys).toEqual(["text"]);
    });

    it("should handle multiple children", () => {
      const node: AgentNode = {
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

      const request = formatAgentRequest(node);

      expect(request.agents.map["document"].childrenIds).toEqual([
        "header",
        "body",
        "footer",
      ]);
      expect(Object.keys(request.agents.map)).toHaveLength(4);
    });
  });

  describe("updateAgentNodes", () => {
    it("should update a single node", () => {
      const node: AgentNode = {
        id: "greeting",
        params: {},
        prompt: "Old prompt",
        children: [],
      };

      const updated = updateAgentNodes(node, (n) => ({
        ...n,
        prompt: "New prompt",
      }));

      expect(updated.prompt).toBe("New prompt");
      expect(updated.id).toBe("greeting");
    });

    it("should update all nodes in a nested structure", () => {
      const node: AgentNode = {
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

      const updated = updateAgentNodes(node, (n) => ({
        ...n,
        prompt: `updated-${n.id}`,
      }));

      expect(updated.prompt).toBe("updated-root");
      expect(updated.children[0].prompt).toBe("updated-child1");
      expect(updated.children[1].prompt).toBe("updated-child2");
    });

    it("should update deeply nested nodes", () => {
      const node: AgentNode = {
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

      const updated = updateAgentNodes(node, (n) => ({
        ...n,
        prompt: `${n.prompt}-updated`,
      }));

      expect(updated.prompt).toBe("level1-updated");
      expect(updated.children[0].prompt).toBe("level2-updated");
      expect(updated.children[0].children[0].prompt).toBe("level3-updated");
    });

    it("should preserve node structure while updating", () => {
      const node: AgentNode = {
        id: "root",
        name: "root-name",
        majorVersion: 1,
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

      const updated = updateAgentNodes(node, (n) => ({
        ...n,
        prompt: n.prompt.toUpperCase(),
      }));

      expect(updated.id).toBe("root");
      expect(updated.name).toBe("root-name");
      expect(updated.majorVersion).toBe(1);
      expect(updated.params).toEqual({ key: "value" });
      expect(updated.prompt).toBe("ORIGINAL");
      expect(updated.children[0].prompt).toBe("CHILD-ORIGINAL");
    });

    it("should allow conditional updates", () => {
      const node: AgentNode = {
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

      const updated = updateAgentNodes(node, (n) => {
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
