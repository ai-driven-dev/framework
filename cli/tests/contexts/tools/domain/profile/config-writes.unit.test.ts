import { describe, expect, it } from "vitest";
import { defineIdeTool } from "../../../../../src/contexts/tools/domain/profile/define-tool.js";
import type { IdeToolConfig } from "../../../../../src/contexts/tools/domain/profile.js";
import { ConfigSection } from "../../../../../src/contexts/tools/domain/sections/config-section.js";
import { HooksConfigPart } from "../../../../../src/contexts/tools/domain/sections/hooks-section.js";
import { McpConfigPart } from "../../../../../src/contexts/tools/domain/sections/mcp-section.js";
import { stubAiTool } from "../../../../helpers/ports/stub-ai-tool.js";
import { TOOL } from "../../testing/catalog-of.js";

const mcp = new McpConfigPart({ outputPath: ".mcp.json", format: "json" });
const hooks = new HooksConfigPart({ outputPath: ".claude/settings.json" });
const hooksSection = { config: hooks, delivery: { kind: "plugin-file" } } as const;
const settings = new ConfigSection({
  outputPath: ".claude/settings.json",
  mergeStrategy: "none",
});
const extensions = new ConfigSection({
  outputPath: ".vscode/extensions.json",
  mergeStrategy: "user-prime",
});

function ideTool(declared: ConfigSection[]): IdeToolConfig {
  return defineIdeTool({
    toolId: TOOL.vscode,
    directory: ".vscode/",
    signalDir: null,
    capabilities: () => ({ config: declared }),
  });
}

describe("configWrites, the config files a tool writes in the order they claim a config", () => {
  describe("an IDE tool", () => {
    it("lists each settings file of a tool declaring several", () => {
      expect(ideTool([extensions, settings]).configWrites()).toStrictEqual([
        { kind: "settings", capability: extensions },
        { kind: "settings", capability: settings },
      ]);
    });

    it("lists the one settings file of a tool declaring a single one", () => {
      expect(ideTool([settings]).configWrites()).toStrictEqual([
        { kind: "settings", capability: settings },
      ]);
    });
  });

  describe("an AI tool", () => {
    it("lists mcp, hooks and settings in that order", () => {
      const tool = stubAiTool(TOOL.claude, {
        mcp: { config: mcp },
        hooks: hooksSection,
        config: [settings],
      });

      expect(tool.configWrites()).toStrictEqual([
        { kind: "mcp", capability: mcp },
        { kind: "hooks", capability: hooks },
        { kind: "settings", capability: settings },
      ]);
    });

    it("lists each settings file of a tool declaring several", () => {
      const tool = stubAiTool(TOOL.claude, { config: [extensions, settings] });

      expect(tool.configWrites()).toStrictEqual([
        { kind: "settings", capability: extensions },
        { kind: "settings", capability: settings },
      ]);
    });

    it("adds no write for an mcp section that only carries a plugin part", () => {
      const tool = stubAiTool(TOOL.claude, {
        mcp: { plugin: { accepts: true, relativePath: ".mcp.json" } },
      });

      expect(tool.configWrites()).toStrictEqual([]);
    });

    it("adds no write for a hooks section that only carries a delivery", () => {
      const tool = stubAiTool(TOOL.claude, { hooks: { delivery: { kind: "plugin-file" } } });

      expect(tool.configWrites()).toStrictEqual([]);
    });

    it("lists nothing for a tool declaring no config capability", () => {
      expect(stubAiTool(TOOL.claude, {}).configWrites()).toStrictEqual([]);
    });
  });
});
