import { describe, expect, it } from "vitest";
import { userPluginsOf } from "../../../../../src/contexts/installation/application/clean/user-plugins-of.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";
import { aUserPlugin, USER_PLUGIN_NAME } from "../../testing/user-scope-purge.builder.js";

describe("listing the user-scope plugins of a manifest", () => {
  it("keeps the user-scope plugins with the AI tool each was installed for", () => {
    const projectPlugin = RecordedPlugin.fromJSON({
      name: "kept",
      source: { kind: "local", path: "/fixture" },
      version: "1.0.0",
      strict: false,
      files: { "k.md": "h" },
      scope: "project",
      dependents: [],
    });
    const manifest = aManifest()
      .withTool(TOOL.claude, [])
      .withPlugin(TOOL.claude, aUserPlugin())
      .withPlugin(TOOL.claude, projectPlugin)
      .build();

    const found = userPluginsOf(manifest, registeredTools());

    expect(found.map(({ toolId, plugin }) => [toolId, plugin.name])).toEqual([
      [TOOL.claude, USER_PLUGIN_NAME],
    ]);
  });

  it("leaves out a tool that is not an AI tool", () => {
    const manifest = aManifest()
      .withTool(TOOL.vscode, [])
      .withPlugin(TOOL.vscode, aUserPlugin())
      .build();

    expect(userPluginsOf(manifest, registeredTools())).toEqual([]);
  });
});
