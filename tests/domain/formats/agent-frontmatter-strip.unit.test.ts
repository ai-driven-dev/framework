import { describe, expect, it } from "vitest";
import {
  COPILOT_AGENT_FRONTMATTER_KEYS,
  stripAgentFrontmatter,
} from "../../../src/domain/formats/agent-frontmatter-strip.js";

describe("stripAgentFrontmatter", () => {
  describe("keeps allowlisted keys", () => {
    it("preserves all six allowed keys when all are present", () => {
      const input = {
        name: "reviewer",
        description: "Reviews code",
        model: "claude-sonnet",
        tools: ["Read", "Write"],
        agents: ["helper"],
        "argument-hint": "[file]",
      };
      const result = stripAgentFrontmatter(input);
      expect(result).toEqual(input);
    });

    it("preserves a subset of allowed keys", () => {
      const input = { name: "reviewer", description: "Reviews code" };
      const result = stripAgentFrontmatter(input);
      expect(result).toEqual({ name: "reviewer", description: "Reviews code" });
    });
  });

  describe("drops non-allowlisted keys", () => {
    it("drops paths key", () => {
      const input = { name: "reviewer", paths: ["src/**/*.ts"] };
      const result = stripAgentFrontmatter(input);
      expect(result).not.toHaveProperty("paths");
      expect(result).toHaveProperty("name");
    });

    it("drops tags key", () => {
      const input = { name: "reviewer", tags: ["code", "review"], description: "Reviews" };
      const result = stripAgentFrontmatter(input);
      expect(result).not.toHaveProperty("tags");
      expect(result).toHaveProperty("description");
    });

    it("drops multiple unknown keys at once", () => {
      const input = { name: "test", version: "1.0", custom: true, description: "desc" };
      const result = stripAgentFrontmatter(input);
      expect(Object.keys(result)).toEqual(COPILOT_AGENT_FRONTMATTER_KEYS.filter((k) => k in input));
    });
  });

  describe("drops undefined values", () => {
    it("excludes keys whose value is undefined", () => {
      const input = { name: "reviewer", model: undefined, description: "desc" };
      const result = stripAgentFrontmatter(input);
      expect(result).not.toHaveProperty("model");
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("description");
    });
  });

  describe("key ordering", () => {
    it("returns keys in allowlist order for deterministic serialization", () => {
      const input = {
        "argument-hint": "[file]",
        model: "sonnet",
        name: "reviewer",
        description: "desc",
      };
      const result = stripAgentFrontmatter(input);
      expect(Object.keys(result)).toEqual(["name", "description", "model", "argument-hint"]);
    });
  });
});
