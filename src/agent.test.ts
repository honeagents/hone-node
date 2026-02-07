import { describe, it, expect } from "vitest";
import {
  getAgentNode,
  formatEntityV2Request,
  updateAgentNodes,
} from "./agent";
import { AgentNode, EntityNode, GetAgentOptions } from "./types";

describe("utils", () => {
  describe("getAgentNode", () => {
    it("should create a simple agent node with no parameters", () => {
      const options: GetAgentOptions = {
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "Hello, World!",
      };

      const node = getAgentNode("greeting", options);

      expect(node).toEqual({
        id: "greeting",
        type: "agent",
        majorVersion: undefined,
        name: undefined,
        params: {},
        prompt: "Hello, World!",
        children: [],
        model: "gpt-4",
        provider: "openai",
        temperature: undefined,
        maxTokens: undefined,
        topP: undefined,
        frequencyPenalty: undefined,
        presencePenalty: undefined,
        stopSequences: undefined,
        tools: undefined,
      });
    });

    it("should create an agent node with simple string parameters", () => {
      const options: GetAgentOptions = {
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "Hello, {{userName}}!",
        params: {
          userName: "Alice",
        },
      };

      const node = getAgentNode("greeting", options);

      expect(node).toEqual({
        id: "greeting",
        type: "agent",
        majorVersion: undefined,
        name: undefined,
        params: {
          userName: "Alice",
        },
        prompt: "Hello, {{userName}}!",
        children: [],
        model: "gpt-4",
        provider: "openai",
        temperature: undefined,
        maxTokens: undefined,
        topP: undefined,
        frequencyPenalty: undefined,
        presencePenalty: undefined,
        stopSequences: undefined,
        tools: undefined,
      });
    });

    it("should create an agent node with majorVersion and name", () => {
      const options: GetAgentOptions = {
        model: "gpt-4",
        provider: "openai",
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
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "Hello!",
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9,
        frequencyPenalty: 0.5,
        presencePenalty: 0.3,
        stopSequences: ["END", "STOP"],
      };

      const node = getAgentNode("greeting", options);

      expect(node.model).toBe("gpt-4");
      expect(node.provider).toBe("openai");
      expect(node.temperature).toBe(0.7);
      expect(node.maxTokens).toBe(1000);
      expect(node.topP).toBe(0.9);
      expect(node.frequencyPenalty).toBe(0.5);
      expect(node.presencePenalty).toBe(0.3);
      expect(node.stopSequences).toEqual(["END", "STOP"]);
    });

    it("should create nested agent nodes from nested options", () => {
      const options: GetAgentOptions = {
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "Intro: {{introduction}}",
        params: {
          introduction: {
            model: "gpt-4",
            provider: "openai",
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
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "{{header}} Content: {{body}} {{footer}}",
        params: {
          header: {
            model: "gpt-4",
            provider: "openai",
            defaultPrompt: "Header text",
          },
          body: {
            model: "gpt-4",
            provider: "openai",
            defaultPrompt: "Body with {{detail}}",
            params: {
              detail: "important info",
            },
          },
          footer: {
            model: "gpt-4",
            provider: "openai",
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
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "This is an agent that references {{system-agent}}",
        params: {
          "system-agent": {
            model: "gpt-4",
            provider: "openai",
            defaultPrompt: "This should cause an error",
          },
        },
      };

      expect(() => getAgentNode("system-agent", options)).toThrow();
    });

    it("should throw an error for circular agent references", () => {
      const options: GetAgentOptions = {
        model: "gpt-4",
        provider: "openai",
        defaultPrompt: "A references {{b}}",
        params: {
          b: {
            model: "gpt-4",
            provider: "openai",
            defaultPrompt: "B references {{a}}",
            params: {
              a: {
                model: "gpt-4",
                provider: "openai",
                defaultPrompt: "A references {{b}} (circular)",
              },
            },
          },
        },
      };

      expect(() => getAgentNode("a", options)).toThrow();
    });
  });

  // Note: Parameter validation and evaluation is handled server-side
  // The following functions were removed: insertParamsIntoPrompt, evaluateAgent, traverseAgentNode, formatEntityRequest

  describe("updateAgentNodes", () => {
    it("should update a single node", () => {
      const node: AgentNode = {
        id: "greeting",
        type: "agent",
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
        type: "agent",
        params: {},
        prompt: "root",
        children: [
          {
            id: "child1",
            type: "agent",
            params: {},
            prompt: "child1",
            children: [],
          },
          {
            id: "child2",
            type: "agent",
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
        type: "agent",
        params: {},
        prompt: "level1",
        children: [
          {
            id: "level2",
            type: "agent",
            params: {},
            prompt: "level2",
            children: [
              {
                id: "level3",
                type: "agent",
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
        type: "agent",
        name: "root-name",
        majorVersion: 1,
        params: { key: "value" },
        prompt: "original",
        children: [
          {
            id: "child",
            type: "agent",
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
        type: "agent",
        params: {},
        prompt: "root",
        children: [
          {
            id: "update-me",
            type: "agent",
            params: {},
            prompt: "old",
            children: [],
          },
          {
            id: "leave-me",
            type: "agent",
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

  describe("formatEntityV2Request", () => {
    it("should format a simple agent node", () => {
      const node: AgentNode = {
        id: "greeting",
        type: "agent",
        name: "greeting-agent",
        majorVersion: 1,
        params: { userName: "Alice" },
        prompt: "Hello, {{userName}}!",
        children: [],
        model: "gpt-4",
        provider: "openai",
      };

      const request = formatEntityV2Request(node);

      expect(request.id).toBe("greeting");
      expect(request.type).toBe("agent");
      expect(request.name).toBe("greeting-agent");
      expect(request.majorVersion).toBe(1);
      expect(request.prompt).toBe("Hello, {{userName}}!");
      expect(request.params).toEqual({ userName: "Alice" });
      expect(request.data?.model).toBe("gpt-4");
      expect(request.data?.provider).toBe("openai");
    });

    it("should format nested agent nodes with param values", () => {
      const node: AgentNode = {
        id: "main",
        type: "agent",
        params: {},
        prompt: "Intro: {{introduction}}",
        children: [
          {
            id: "introduction",
            type: "prompt",
            params: { userName: "Bob" },
            prompt: "Hello, {{userName}}!",
            children: [],
          },
        ],
        model: "gpt-4",
        provider: "openai",
      };

      const request = formatEntityV2Request(node);

      expect(request.id).toBe("main");
      expect(request.type).toBe("agent");
      expect(request.params).toBeDefined();
      expect(request.params?.introduction).toBeDefined();

      // The nested entity should be a full EntityV2Request object
      const nestedIntro = request.params?.introduction as Record<string, unknown>;
      expect(nestedIntro.id).toBe("introduction");
      expect(nestedIntro.type).toBe("prompt");
      expect(nestedIntro.prompt).toBe("Hello, {{userName}}!");
      expect(nestedIntro.params).toEqual({ userName: "Bob" });
    });

    it("should format agent node with all hyperparameters in data", () => {
      const node: AgentNode = {
        id: "greeting",
        type: "agent",
        params: {},
        prompt: "Hello!",
        children: [],
        model: "gpt-4",
        provider: "openai",
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9,
        frequencyPenalty: 0.5,
        presencePenalty: 0.3,
        stopSequences: ["END"],
        tools: ["search", "calculator"],
      };

      const request = formatEntityV2Request(node);

      expect(request.data).toBeDefined();
      expect(request.data?.model).toBe("gpt-4");
      expect(request.data?.provider).toBe("openai");
      expect(request.data?.temperature).toBe(0.7);
      expect(request.data?.maxTokens).toBe(1000);
      expect(request.data?.topP).toBe(0.9);
      expect(request.data?.frequencyPenalty).toBe(0.5);
      expect(request.data?.presencePenalty).toBe(0.3);
      expect(request.data?.stopSequences).toEqual(["END"]);
      expect(request.data?.tools).toEqual(["search", "calculator"]);
    });

    it("should not include data for non-agent types", () => {
      const node: EntityNode = {
        id: "my-prompt",
        type: "prompt",
        params: { value: "test" },
        prompt: "Value: {{value}}",
        children: [],
      };

      const request = formatEntityV2Request(node);

      expect(request.id).toBe("my-prompt");
      expect(request.type).toBe("prompt");
      expect(request.data).toBeUndefined();
    });

    it("should format deeply nested structure", () => {
      const node: AgentNode = {
        id: "doc",
        type: "agent",
        params: {},
        prompt: "{{section}}",
        children: [
          {
            id: "section",
            type: "prompt",
            params: {},
            prompt: "{{paragraph}}",
            children: [
              {
                id: "paragraph",
                type: "prompt",
                params: { text: "content" },
                prompt: "{{text}}",
                children: [],
              },
            ],
          },
        ],
        model: "gpt-4",
        provider: "openai",
      };

      const request = formatEntityV2Request(node);

      expect(request.id).toBe("doc");
      const section = request.params?.section as Record<string, unknown>;
      expect(section.id).toBe("section");
      const paragraph = (section.params as Record<string, unknown>)?.paragraph as Record<string, unknown>;
      expect(paragraph.id).toBe("paragraph");
      expect(paragraph.params).toEqual({ text: "content" });
    });

    it("should mix string params and nested entities", () => {
      const node: AgentNode = {
        id: "document",
        type: "agent",
        params: { title: "My Document" },
        prompt: "{{title}}: {{body}}",
        children: [
          {
            id: "body",
            type: "prompt",
            params: { content: "Hello World" },
            prompt: "Content: {{content}}",
            children: [],
          },
        ],
        model: "gpt-4",
        provider: "openai",
      };

      const request = formatEntityV2Request(node);

      expect(request.params?.title).toBe("My Document"); // String param
      expect(typeof request.params?.body).toBe("object"); // Nested entity
      const body = request.params?.body as Record<string, unknown>;
      expect(body.id).toBe("body");
    });

    it("should omit params when empty", () => {
      const node: EntityNode = {
        id: "simple",
        type: "prompt",
        params: {},
        prompt: "Static text",
        children: [],
      };

      const request = formatEntityV2Request(node);

      expect(request.params).toBeUndefined();
    });

    it("should handle multiple children", () => {
      const node: AgentNode = {
        id: "document",
        type: "agent",
        params: {},
        prompt: "{{header}} {{body}} {{footer}}",
        children: [
          {
            id: "header",
            type: "prompt",
            params: {},
            prompt: "HEADER",
            children: [],
          },
          {
            id: "body",
            type: "prompt",
            params: { content: "text" },
            prompt: "{{content}}",
            children: [],
          },
          {
            id: "footer",
            type: "prompt",
            params: {},
            prompt: "FOOTER",
            children: [],
          },
        ],
        model: "gpt-4",
        provider: "openai",
      };

      const request = formatEntityV2Request(node);

      expect(Object.keys(request.params || {})).toHaveLength(3);
      expect(request.params?.header).toBeDefined();
      expect(request.params?.body).toBeDefined();
      expect(request.params?.footer).toBeDefined();
    });
  });
});
