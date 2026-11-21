import { describe, expect, it } from "vitest";
import { pluginTreeContract } from "../../../../../src/contexts/tools/domain/formats/plugin-tree-contract.js";
import { cursor } from "../../../../../src/contexts/tools/domain/profiles/cursor/cursor.profile.js";
import { present } from "../../../../shared/testing/present.builder.js";
import { supported } from "../../testing/build-artifacts.builder.js";

const LAYOUT = {
  manifestRelative: ".tool-plugin/plugin.json",
  marketplaceRelative: ".tool-plugin/marketplace.json",
  transformAgent: (content: string) => `rewritten:${content}`,
};

const contract = pluginTreeContract(present(cursor.hooks), LAYOUT);

describe("pluginTreeContract", () => {
  it("names the tool's own manifest and sends agents through its own transform", () => {
    expect({
      manifest: contract.manifestFileRelative,
      agent: supported(contract.artifacts.agents).transform?.("x", "p", "a.md"),
    }).toStrictEqual({ manifest: ".tool-plugin/plugin.json", agent: "rewritten:x" });
  });

  it("keeps skills and agents where the plugin has them, and MCP at its root", () => {
    expect({
      skill: supported(contract.artifacts.skills).path("p", "skills/a/SKILL.md"),
      agent: supported(contract.artifacts.agents).path("p", "agents/a.md"),
      mcp: supported(contract.artifacts.mcp).path("p", ".mcp.json"),
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
