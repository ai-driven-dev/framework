import { describe, expect, it } from "vitest";
import {
  COPILOT_AGENT_FRONTMATTER_KEYS,
  CURSOR_AGENT_FRONTMATTER_KEYS,
  stripCopilotAgentFrontmatter,
  stripCursorAgentFrontmatter,
  stripPathIdAgentFrontmatter,
} from "../../../../../src/contexts/tools/domain/formats/agent-frontmatter-strip.js";

describe("stripCopilotAgentFrontmatter", () => {
  it("keeps name, description and model, and reads Claude's effort as reasoningEffort", () => {
    expect(
      stripCopilotAgentFrontmatter({
        name: "reviewer",
        description: "Reviews code",
        model: "claude-sonnet",
        effort: "high",
      })
    ).toEqual({
      name: "reviewer",
      description: "Reviews code",
      model: "claude-sonnet",
      reasoningEffort: "high",
      "include-custom-instructions": true,
    });
  });

  it("drops tools and every other key, so the agent keeps Copilot's default of all tools", () => {
    const result = stripCopilotAgentFrontmatter({
      name: "reviewer",
      tools: ["Read"],
      agents: ["helper"],
      "argument-hint": "[file]",
      color: "red",
    });
    expect(Object.keys(result)).toEqual(["name", "include-custom-instructions"]);
  });

  it("preserves an explicit repository-instruction opt-out", () => {
    expect(stripCopilotAgentFrontmatter({ "include-custom-instructions": false })).toEqual({
      "include-custom-instructions": false,
    });
  });

  it("returns keys in allowlist order for deterministic serialization", () => {
    const result = stripCopilotAgentFrontmatter({
      effort: "low",
      model: "sonnet",
      name: "reviewer",
      description: "desc",
    });
    expect(Object.keys(result)).toEqual(COPILOT_AGENT_FRONTMATTER_KEYS);
  });
});

describe("stripPathIdAgentFrontmatter", () => {
  it("keeps description and model only: the file name is the ID, and no key restricts tools", () => {
    expect(
      stripPathIdAgentFrontmatter({
        name: "explorer",
        description: "d",
        model: "openai/gpt",
        effort: "high",
        tools: "Read",
      })
    ).toEqual({ description: "d", model: "openai/gpt" });
  });
});

describe("stripCursorAgentFrontmatter", () => {
  it("drops tools, color, argument-hint — keeps only name/description/model", () => {
    const input = {
      name: "planner",
      description: "Plans tasks",
      model: "claude-sonnet",
      tools: ["Read", "Write"],
      color: "#ff0000",
      "argument-hint": "[task]",
    };
    const result = stripCursorAgentFrontmatter(input);
    expect(result).toEqual({
      name: "planner",
      description: "Plans tasks",
      model: "claude-sonnet",
    });
    expect(result).not.toHaveProperty("tools");
    expect(result).not.toHaveProperty("color");
    expect(result).not.toHaveProperty("argument-hint");
  });

  it("preserves a subset: name only", () => {
    const result = stripCursorAgentFrontmatter({ name: "agent" });
    expect(result).toEqual({ name: "agent" });
  });

  it("omits model when undefined", () => {
    const result = stripCursorAgentFrontmatter({ name: "agent", model: undefined });
    expect(result).not.toHaveProperty("model");
  });

  it("returns keys in CURSOR_AGENT_FRONTMATTER_KEYS order", () => {
    const input = { model: "sonnet", description: "desc", name: "agent" };
    const result = stripCursorAgentFrontmatter(input);
    expect(Object.keys(result)).toEqual(CURSOR_AGENT_FRONTMATTER_KEYS.filter((k) => k in input));
  });

  it("CURSOR_AGENT_FRONTMATTER_KEYS is exactly [name, description, model]", () => {
    expect(CURSOR_AGENT_FRONTMATTER_KEYS).toEqual(["name", "description", "model"]);
  });
});
