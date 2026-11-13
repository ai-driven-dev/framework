import { describe, expect, it } from "vitest";
import { HooksCapability } from "../../../../../src/contexts/tools/domain/capabilities/hooks-capability.js";
import { McpCapability } from "../../../../../src/contexts/tools/domain/capabilities/mcp-capability.js";
import { SettingsCapability } from "../../../../../src/contexts/tools/domain/capabilities/settings-capability.js";
import type { IdeToolConfig } from "../../../../../src/contexts/tools/domain/contracts.js";
import { defineIdeTool } from "../../../../../src/contexts/tools/domain/profile/define-tool.js";
import { stubAiTool } from "../../../../helpers/ports/stub-ai-tool.js";

const mcp = new McpCapability({ outputPath: ".mcp.json", format: "json" });
const hooks = new HooksCapability({ outputPath: ".claude/settings.json" });
const settings = new SettingsCapability({
  outputPath: ".claude/settings.json",
  mergeStrategy: "none",
});
const extensions = new SettingsCapability({
  outputPath: ".vscode/extensions.json",
  mergeStrategy: "user-prime",
});

function ideTool(declared: SettingsCapability[]): IdeToolConfig {
  return defineIdeTool({
    toolId: "vscode",
    directory: ".vscode/",
    signalDir: null,
    capabilities: () => ({ settings: declared }),
  });
}

describe("configCapabilities, the config files a tool declares", () => {
  describe("an IDE tool", () => {
    it("lists each settings file of a tool declaring several", () => {
      expect(ideTool([extensions, settings]).configCapabilities()).toStrictEqual([
        extensions,
        settings,
      ]);
    });

    it("lists the one settings file of a tool declaring a single one", () => {
      expect(ideTool([settings]).configCapabilities()).toStrictEqual([settings]);
    });
  });

  describe("an AI tool", () => {
    it("lists mcp, hooks and settings in that order", () => {
      const tool = stubAiTool("claude", { mcp, hooks, settings: [settings] });

      expect(tool.configCapabilities()).toStrictEqual([mcp, hooks, settings]);
    });

    it("lists each settings file of a tool declaring several", () => {
      const tool = stubAiTool("claude", { settings: [extensions, settings] });

      expect(tool.configCapabilities()).toStrictEqual([extensions, settings]);
    });

    it("lists nothing for a tool declaring no config capability", () => {
      expect(stubAiTool("claude", {}).configCapabilities()).toStrictEqual([]);
    });
  });
});
