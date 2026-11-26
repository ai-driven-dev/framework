import { describe, expect, it } from "vitest";
import {
  SYNTHETIC_LISTED_TOOL,
  SYNTHETIC_NATIVE_TOOL,
  syntheticSyncCatalog,
} from "../../shared/testing/synthetic-native-tool.builder.js";
import {
  hostPluginProofFixture,
  ownedAndOtherCatalogues,
} from "../testing/source-provenance.builder.js";

const claude = SYNTHETIC_NATIVE_TOOL;
const codex = SYNTHETIC_LISTED_TOOL;

function expectedMachineMarketplaces<T>(machineCatalogue: boolean, other: T, target: T) {
  return machineCatalogue ? [other, target] : [other];
}

const REAL = {
  tools: syntheticSyncCatalog(),
  ids: { claude: SYNTHETIC_NATIVE_TOOL, codex: SYNTHETIC_LISTED_TOOL },
};

describe("native catalogue ownership recorded from source provenance", () => {
  it.each([
    {
      toolId: claude,
      marketplaceScope: "user",
      machineCatalogue: true,
      otherHost: "other-catalog",
    },
    {
      toolId: claude,
      marketplaceScope: "project",
      machineCatalogue: false,
      otherHost: "other-catalog",
    },
    {
      toolId: codex,
      marketplaceScope: "user",
      machineCatalogue: true,
      otherHost: "other-catalog",
    },
    {
      toolId: codex,
      marketplaceScope: "project",
      machineCatalogue: true,
      otherHost: "other-catalog",
    },
    {
      toolId: claude,
      marketplaceScope: "user",
      machineCatalogue: true,
      otherHost: "same-name",
    },
    {
      toolId: codex,
      marketplaceScope: "project",
      machineCatalogue: true,
      otherHost: "same-name",
    },
  ] as const)(
    "owns only the catalogue, not undeclared plugins, and is idempotent for $toolId / $marketplaceScope / $otherHost",
    async ({ toolId, marketplaceScope, machineCatalogue, otherHost }) => {
      const f = await hostPluginProofFixture(
        { location: "/host/plugins.json", refs: new Map() },
        { ...REAL, toolId, marketplaceScope, plugin: false }
      );
      const machine = f.machineRepo.getCurrent();
      if (machine === null) throw new Error("fixture lacks machine manifest");
      const { target, other, otherRef } = ownedAndOtherCatalogues(
        SYNTHETIC_NATIVE_TOOL,
        toolId,
        otherHost
      );
      machine.addTool(toolId, "0.9.0", []);
      f.machineRepo.records.set(toolId, {
        binary: toolId,
        marketplaces: [other],
        pluginRefs: [otherRef],
        pluginClaims: [{ ref: otherRef, dependents: ["/B"] }],
      });

      const machineMarketplaces = expectedMachineMarketplaces(machineCatalogue, other, target);
      for (let run = 0; run < 2; run += 1) {
        const result = await f.sync.execute({ projectRoot: "/A" });
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(f.projectRepo.records.get(toolId)).toEqual({
          binary: toolId,
          marketplaces: [target],
          pluginRefs: [],
        });
        expect(f.machineRepo.records.get(toolId)).toEqual({
          binary: toolId,
          marketplaces: machineMarketplaces,
          pluginRefs: [otherRef],
          pluginClaims: [{ ref: otherRef, dependents: ["/B"] }],
        });
        expect(f.machineRepo.saveCount).toBe(machineMarketplaces.length - 1);
        expect(f.machineRepo.getCurrent()?.getToolVersion(toolId)).toBe("0.9.0");
      }
      expect(f.activator.addedMarketplaces).toEqual([`/built/${toolId}`]);
      expect(f.activator.enabledPlugins).toEqual([]);
      expect(f.activator.removedMarketplaces).toEqual([]);
      expect(f.activator.upgradeCount).toBe(1);
      expect(f.fs.getFile("/foreign/cache/marker.json")).toBe("foreign bytes");
    }
  );

  it.each([claude, codex] as const)(
    "initializes a fresh %s machine tool record for a catalogue without claiming its available plugins",
    async (toolId) => {
      const f = await hostPluginProofFixture(
        { location: "/host/plugins.json", refs: new Map() },
        { ...REAL, toolId, marketplaceScope: "user", plugin: false }
      );
      const result = await f.sync.execute({ projectRoot: "/A" });
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(f.machineRepo.getCurrent()?.hasTool(toolId)).toBe(true);
      expect(f.machineRepo.getCurrent()?.getToolVersion(toolId)).toBe("1.0.0");
      expect(f.machineRepo.records.get(toolId)).toMatchObject({
        binary: toolId,
        marketplaces: [{ alias: "alias", hostName: "same-name" }],
        pluginRefs: [],
        pluginClaims: [],
      });
      expect(f.machineRepo.saveCount).toBe(1);
      expect(f.activator.enabledPlugins).toEqual([]);
    }
  );
});
