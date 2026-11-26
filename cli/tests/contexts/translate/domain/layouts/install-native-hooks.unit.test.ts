import { describe, expect, it } from "vitest";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import { nativeOf } from "../../../../shared/testing/native-plugin-answers.builder.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { translator } from "../../testing/engine-kit.builder.js";
import {
  antigravity,
  claude,
  codex,
  cursor,
  opencode,
} from "../../testing/registered-profiles.builder.js";

const HOOKS_CONTENT = JSON.stringify({
  hooks: { SessionStart: [{ hooks: [{ type: "command", command: "node ./hooks/start.js" }] }] },
});

function buildDist(hasHooks: boolean, name = "test-plugin"): PluginDistribution {
  const hooksFile = { relativePath: "hooks/hooks.json", content: HOOKS_CONTENT };
  return new PluginDistribution({
    manifest: { name: parsePluginName(name), version: "1.0.0" },
    format: TOOL.claude,
    files: hasHooks ? [hooksFile] : [],
    components: {
      commands: [],
      agents: [],
      rules: [],
      skills: [],
      hooks: hasHooks ? [hooksFile] : [],
      mcp: [],
    },
  });
}

describe("the engine hook trust notice", () => {
  it("names what Codex still requires when the plugin actually delivers a hook", () => {
    const result = translator.translateWithComponentPaths(buildDist(true), codex);

    expect(result.notices).toHaveLength(1);
    expect(result.notices[0]).toMatchObject({
      pluginName: "test-plugin",
      component: "hooks",
      toolId: TOOL.codex,
      message: nativeOf(codex.plugins()).trustNotice(),
    });
  });

  it("says nothing when the plugin delivers no hook, even for a gated tool", () => {
    const result = translator.translateWithComponentPaths(buildDist(false), codex);

    expect(result.notices).toEqual([]);
  });

  it("says nothing for a tool that runs a delivered hook with no trust gate", () => {
    const result = translator.translateWithComponentPaths(buildDist(true), cursor);

    expect(result.notices).toEqual([]);
  });

  it("says nothing in flat mode, where a delivered hook is never native-materialized", () => {
    const result = translator.translateWithComponentPaths(buildDist(true), opencode);

    expect(result.notices).toEqual([]);
  });
});

describe("a plugin's hooks file in a native install", () => {
  it("is the file agy reads at the plugin's root, in the group agy reads", () => {
    const tree = Object.fromEntries(
      translator
        .translate(buildDist(true, "test-plugin"), antigravity)
        .map((file) => [file.relativePath, file.content])
    );

    const group = JSON.parse(tree[".agents/plugins/test-plugin/hooks.json"] ?? "{}");
    expect([
      Object.keys(tree).filter((path) => path.endsWith("hooks/hooks.json")),
      Object.keys(group),
    ]).toEqual([[], ["test-plugin"]]);
  });

  it("stays the plugin's own hooks.json for a tool that converts none", () => {
    const tree = Object.fromEntries(
      translator
        .translate(buildDist(true, "test-plugin"), claude)
        .map((file) => [file.relativePath, file.content])
    );

    expect(tree[".claude/plugins/test-plugin/hooks/hooks.json"]).toBe(HOOKS_CONTENT);
  });
});
