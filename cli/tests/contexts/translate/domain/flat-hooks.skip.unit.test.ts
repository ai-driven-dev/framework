import { describe, expect, it } from "vitest";
import { PluginDistribution } from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { translator } from "../testing/engine-kit.builder.js";
import { cursor, opencode } from "../testing/registered-profiles.builder.js";

const HOOKS_CONTENT = JSON.stringify({
  hooks: { PreToolUse: [{ hooks: [{ type: "command", command: "node ./hooks/pre.js" }] }] },
});

function buildDistWithNoHooksMcp(name = "test-plugin"): PluginDistribution {
  return new PluginDistribution({
    manifest: { name, version: "1.0.0" },
    format: TOOL.claude,
    files: [
      { relativePath: "commands/greet.md", content: "---\nname: aidd:01:greet\n---\n# Greet" },
    ],
    components: {
      commands: [
        { relativePath: "commands/greet.md", content: "---\nname: aidd:01:greet\n---\n# Greet" },
      ],
      agents: [],
      rules: [],
      skills: [],
      hooks: [],
      mcp: [],
    },
  });
}

function buildDistWithHooks(name = "test-plugin"): PluginDistribution {
  return new PluginDistribution({
    manifest: { name, version: "1.0.0" },
    format: TOOL.claude,
    files: [
      { relativePath: "hooks/hooks.json", content: HOOKS_CONTENT },
      { relativePath: "hooks/pre.js", content: "module.exports = () => {};" },
    ],
    components: {
      commands: [],
      agents: [],
      rules: [],
      skills: [],
      hooks: [
        { relativePath: "hooks/hooks.json", content: HOOKS_CONTENT },
        { relativePath: "hooks/pre.js", content: "module.exports = () => {};" },
      ],
      mcp: [],
    },
  });
}

describe("the engine skip list", () => {
  describe("flat mode (opencode)", () => {
    it("returns empty skipped list when plugin has no hooks or mcp", () => {
      const dist = buildDistWithNoHooksMcp();
      const result = translator.translateWithComponentPaths(dist, opencode);
      expect(result.skipped).toEqual([]);
    });

    it("returns no skip entry when plugin has hooks - OpenCode now accepts them", () => {
      const dist = buildDistWithHooks("aidd-pm");
      const result = translator.translateWithComponentPaths(dist, opencode);
      expect(result.skipped).toEqual([]);
    });

    it("delivers every hooks/ file but hooks.json namespaced under the plugin's own flatHooksDir subtree", () => {
      const dist = buildDistWithHooks("aidd-pm");
      const result = translator.translateWithComponentPaths(dist, opencode);
      const paths = result.files.map((f) => f.relativePath);
      expect(paths).toContain(".opencode/hooks/aidd-pm/pre.js");
      expect(paths).not.toContain(".opencode/hooks/aidd-pm/hooks.json");
      // Never OpenCode's own scanned plugin directory: a plain hook script there is
      // imported in-process and kills the host.
      expect(paths).not.toContain(".opencode/plugin/pre.js");
    });
  });

  describe("native mode (cursor)", () => {
    it("returns empty skipped list when plugin has no hooks or mcp", () => {
      const dist = buildDistWithNoHooksMcp();
      const result = translator.translateWithComponentPaths(dist, cursor);
      expect(result.skipped).toEqual([]);
    });

    it("returns empty skipped list when plugin has hooks (cursor acceptsHooks: true)", () => {
      const dist = buildDistWithHooks("test-plugin");
      const result = translator.translateWithComponentPaths(dist, cursor);
      expect(result.skipped).toEqual([]);
    });
  });
});
