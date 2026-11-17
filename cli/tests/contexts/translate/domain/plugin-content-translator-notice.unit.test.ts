import { describe, expect, it } from "vitest";
import { PluginContentEngine } from "../../../../src/contexts/translate/domain/engine.js";
import { PluginDistribution } from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { nativeOf } from "../../../shared/testing/native-plugin-answers.js";
import { TOOL } from "../../../shared/testing/registered-tools.js";
import { registeredManifestPaths } from "../../translate/testing/registered-manifest-probes.js";
import { codex, cursor, opencode } from "../testing/registered-profiles.js";

const translator = new PluginContentEngine(registeredManifestPaths());

const HOOKS_CONTENT = JSON.stringify({
  hooks: { SessionStart: [{ hooks: [{ type: "command", command: "node ./hooks/start.js" }] }] },
});

function buildDist(hasHooks: boolean, name = "test-plugin"): PluginDistribution {
  const hooksFile = { relativePath: "hooks/hooks.json", content: HOOKS_CONTENT };
  return new PluginDistribution({
    manifest: { name, version: "1.0.0" },
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

describe("PluginContentTranslator hook trust notice", () => {
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
