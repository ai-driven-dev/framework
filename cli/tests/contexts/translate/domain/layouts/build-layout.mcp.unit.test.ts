import { describe, expect, it } from "vitest";
import { translateBuildLayout } from "../../../../shared/testing/build-files.builder.js";
import { aCanon } from "../../testing/canon-distribution.builder.js";
import { CLAUDE_ROOT_TOKEN } from "../../testing/engine-kit.builder.js";
import {
  aStubBuildContract,
  aSupportedArtifact,
} from "../../testing/stub-build-contract.builder.js";

const PLUGIN = "plug";
const OTHER_ROOT = "$" + "{PLUGIN_ROOT}";

function mcpBuilt(
  files: Record<string, string>,
  mcp = aSupportedArtifact(),
  pluginRootToken?: string
) {
  const contract = aStubBuildContract();
  const built = translateBuildLayout(
    aCanon(PLUGIN, files),
    {
      ...contract,
      pluginRootToken,
      artifacts: {
        ...contract.artifacts,
        mcp,
        agents: { supported: false },
        skills: { supported: false },
        hooks: { supported: false },
      },
    },
    "marketplace"
  );
  return Object.fromEntries(built.map((file) => [file.relativePath, file.content]));
}

describe("the marketplace layout of a plugin's mcp servers", () => {
  it("builds nothing for a plugin declaring none", () => {
    expect(mcpBuilt({ "README.md": "# Readme" })).toEqual({});
  });

  it("carries the declaration at the plugin's root", () => {
    expect(mcpBuilt({ ".mcp.json": "{}" })).toEqual({ "plugins/plug/.mcp.json": "{}" });
  });

  it("hands the declaration to the transform with the plugin and its file name", () => {
    const transform = (content: string, plugin: string, base: string) =>
      `${plugin}:${base}:${content}`;
    expect(mcpBuilt({ ".mcp.json": "{}" }, aSupportedArtifact({ transform }))).toEqual({
      "plugins/plug/.mcp.json": "plug:.mcp.json:{}",
    });
  });

  it("names the tool's own plugin root where the source names its own", () => {
    expect(
      mcpBuilt(
        { ".mcp.json": `{"command":"${CLAUDE_ROOT_TOKEN}/run"}` },
        aSupportedArtifact(),
        OTHER_ROOT
      )
    ).toEqual({ "plugins/plug/.mcp.json": `{"command":"${OTHER_ROOT}/run"}` });
  });

  it("builds no declaration for a tool that has none", () => {
    expect(mcpBuilt({ ".mcp.json": "{}" }, { supported: false })).toEqual({});
  });
});
