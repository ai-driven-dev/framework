import { describe, expect, it } from "vitest";
import { pluginsOnOtherTools } from "../../../../../src/contexts/installation/application/install/plugins-on-other-tools.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

function plugin(name: string): InstalledPlugin {
  return InstalledPlugin.fromMetadata({
    name,
    version: "1.0.0",
    source: { kind: "local", path: "/fixture" },
    strict: false,
    scope: "project",
  });
}

describe("pluginsOnOtherTools", () => {
  it("lists a plugin once when several other tools carry it and skips the named tool's own", () => {
    const manifest = aManifest()
      .withTool(TOOL.claude, [])
      .withTool(TOOL.cursor, [])
      .withTool(TOOL.opencode, [])
      .withPlugin(TOOL.claude, plugin("own-only"))
      .withPlugin(TOOL.cursor, plugin("shared"))
      .withPlugin(TOOL.opencode, plugin("shared"))
      .withPlugin(TOOL.opencode, plugin("opencode-only"))
      .build();

    const names = pluginsOnOtherTools(manifest, TOOL.claude).map((p) => p.name);

    expect(names).toEqual(["shared", "opencode-only"]);
  });
});
