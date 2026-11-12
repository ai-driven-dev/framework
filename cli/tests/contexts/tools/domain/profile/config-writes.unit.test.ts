import { describe, expect, it } from "vitest";
import { defineIdeTool } from "../../../../../src/contexts/tools/domain/profile/define-tool.js";
import type { IdeToolConfig } from "../../../../../src/contexts/tools/domain/profile.js";
import { HooksCapability } from "../../../../../src/contexts/tools/domain/sections/hooks-capability.js";
import { McpCapability } from "../../../../../src/contexts/tools/domain/sections/mcp-capability.js";
import { SettingsCapability } from "../../../../../src/contexts/tools/domain/sections/settings-capability.js";
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
      const tool = stubAiTool("claude", { mcp, hooks, settings: [settings] });

      expect(tool.configWrites()).toStrictEqual([
        { kind: "mcp", capability: mcp },
        { kind: "hooks", capability: hooks },
        { kind: "settings", capability: settings },
      ]);
    });

    it("lists each settings file of a tool declaring several", () => {
      const tool = stubAiTool("claude", { settings: [extensions, settings] });

      expect(tool.configWrites()).toStrictEqual([
        { kind: "settings", capability: extensions },
        { kind: "settings", capability: settings },
      ]);
    });

    it("lists nothing for a tool declaring no config capability", () => {
      expect(stubAiTool("claude", {}).configWrites()).toStrictEqual([]);
    });
  });
});
