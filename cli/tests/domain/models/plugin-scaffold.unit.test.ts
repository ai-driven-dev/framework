import { describe, expect, it } from "vitest";
import { buildScaffold } from "../../../src/domain/models/plugin-scaffold.js";

const BASE_INPUT = { name: "my-plugin", version: "0.1.0", description: "A test plugin" };

describe("buildScaffold", () => {
  describe("common files", () => {
    it("always includes plugin manifest, README, and CHANGELOG", () => {
      const scaffold = buildScaffold({ ...BASE_INPUT, kind: "full" });
      expect(scaffold.has(".claude-plugin/plugin.json")).toBe(true);
      expect(scaffold.has("README.md")).toBe(true);
      expect(scaffold.has("CHANGELOG.md")).toBe(true);
    });

    it("manifest JSON contains the plugin name", () => {
      const scaffold = buildScaffold({ ...BASE_INPUT, kind: "full" });
      const manifest = scaffold.get(".claude-plugin/plugin.json") ?? "";
      expect(JSON.parse(manifest)).toMatchObject({ name: "my-plugin" });
    });
  });

  describe("kind: full", () => {
    it("includes skills, agents, hooks, and mcp files", () => {
      const scaffold = buildScaffold({ ...BASE_INPUT, kind: "full" });
      expect(scaffold.has("skills/00-example/SKILL.md")).toBe(true);
      expect(scaffold.has("agents/example.md")).toBe(true);
      expect(scaffold.has("hooks/hooks.json")).toBe(true);
      expect(scaffold.has(".mcp.json")).toBe(true);
    });
  });

  describe("kind: skills", () => {
    it("includes only skills files (no agents, hooks, mcp)", () => {
      const scaffold = buildScaffold({ ...BASE_INPUT, kind: "skills" });
      expect(scaffold.has("skills/00-example/SKILL.md")).toBe(true);
      expect(scaffold.has("agents/example.md")).toBe(false);
      expect(scaffold.has("hooks/hooks.json")).toBe(false);
      expect(scaffold.has(".mcp.json")).toBe(false);
    });
  });

  describe("kind: agents", () => {
    it("includes only agents files (no skills, hooks, mcp)", () => {
      const scaffold = buildScaffold({ ...BASE_INPUT, kind: "agents" });
      expect(scaffold.has("agents/example.md")).toBe(true);
      expect(scaffold.has("skills/00-example/SKILL.md")).toBe(false);
      expect(scaffold.has("hooks/hooks.json")).toBe(false);
    });
  });

  describe("kind: hooks", () => {
    it("includes only hooks files", () => {
      const scaffold = buildScaffold({ ...BASE_INPUT, kind: "hooks" });
      expect(scaffold.has("hooks/hooks.json")).toBe(true);
      expect(scaffold.has("hooks/routing/.gitkeep")).toBe(true);
      expect(scaffold.has("skills/00-example/SKILL.md")).toBe(false);
    });
  });

  describe("kind: mcp", () => {
    it("includes only mcp files", () => {
      const scaffold = buildScaffold({ ...BASE_INPUT, kind: "mcp" });
      expect(scaffold.has(".mcp.json")).toBe(true);
      expect(scaffold.has("hooks/hooks.json")).toBe(false);
    });
  });

  it("skills include evals/scenarios.json", () => {
    const scaffold = buildScaffold({ ...BASE_INPUT, kind: "skills" });
    expect(scaffold.has("skills/00-example/evals/scenarios.json")).toBe(true);
  });

  it("returns a ReadonlyMap", () => {
    const scaffold = buildScaffold({ ...BASE_INPUT, kind: "full" });
    expect(scaffold).toBeInstanceOf(Map);
  });
});
