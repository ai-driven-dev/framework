import { describe, expect, it } from "vitest";
import { artifactPath } from "../../../../../src/contexts/tools/contract/artifact-path.js";
import { pluginTreeContract } from "../../../../../src/contexts/tools/domain/formats/plugin-tree-contract.js";
import { cursor } from "../../../../../src/contexts/tools/domain/profiles/cursor/cursor.profile.js";
import { present } from "../../../../shared/testing/present.builder.js";
import { supported } from "../../testing/build-artifacts.builder.js";

const LAYOUT = {
  manifestRelative: ".tool-plugin/plugin.json",
  marketplaceRelative: ".tool-plugin/marketplace.json",
  agentMarkdown: { frontmatter: (fm: Record<string, unknown>) => ({ ...fm, marker: "kept" }) },
};

const contract = pluginTreeContract(present(cursor.hooks), LAYOUT);

describe("pluginTreeContract", () => {
  it("names the tool's own manifest and shapes agents with its own frontmatter", () => {
    expect({
      manifest: contract.manifestFileRelative,
      agent: supported(contract.artifacts.agents).agentMarkdown?.frontmatter(
        { a: 1 },
        {
          plugin: "p",
          outName: "a.md",
        }
      ),
    }).toStrictEqual({ manifest: ".tool-plugin/plugin.json", agent: { a: 1, marker: "kept" } });
  });

  it("keeps skills and agents where the plugin has them, and MCP at its root", () => {
    expect({
      skill: artifactPath(supported(contract.artifacts.skills), "p", "skills/a/SKILL.md"),
      agent: artifactPath(supported(contract.artifacts.agents), "p", "agents/a.md"),
      mcp: artifactPath(supported(contract.artifacts.mcp), "p", ".mcp.json"),
    }).toStrictEqual({
      skill: "skills/a/SKILL.md",
      agent: "agents/a.md",
      mcp: ".mcp.json",
    });
  });

  it("writes the marketplace catalog where the layout says", async () => {
    const built = await contract.buildMarketplaceCatalog?.({ name: "m", plugins: [] }, [], {
      readFile: async () => "",
    });
    expect(built?.destRelPath).toBe(".tool-plugin/marketplace.json");
  });
});
