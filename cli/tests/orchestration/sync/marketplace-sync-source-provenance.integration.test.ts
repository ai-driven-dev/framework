import { describe, expect, it } from "vitest";
import {
  SYNTHETIC_LISTED_TOOL,
  SYNTHETIC_NATIVE_TOOL,
  syntheticSyncCatalog,
} from "../../shared/testing/synthetic-native-tool.builder.js";
import { hostPluginProofFixture } from "../testing/source-provenance.builder.js";

const claude = SYNTHETIC_NATIVE_TOOL;
const codex = SYNTHETIC_LISTED_TOOL;

const REAL = {
  tools: syntheticSyncCatalog(),
  ids: { claude: SYNTHETIC_NATIVE_TOOL, codex: SYNTHETIC_LISTED_TOOL },
};

describe("native catalogue source provenance", () => {
  it.each(["project", "user"] as const)(
    "refuses a %s-scope Claude catalogue if its registry becomes unreadable after the source check",
    async (marketplaceScope) => {
      const f = await hostPluginProofFixture(
        { location: "/host/plugins.json", refs: new Map() },
        {
          ...REAL,
          toolId: claude,
          marketplaceScope,
          catalogue: { location: "/host/catalogues.json", unreadable: "permission denied" },
        }
      );
      const result = await f.sync.execute({ projectRoot: "/A" });
      expect(result.errors).toEqual([]);
      expect(result.warnings.join(" ")).toMatch(/same-name.*host registry is unreadable/);
      expect(f.activator.addedMarketplaces).toEqual([]);
      expect(f.activator.enabledPlugins).toEqual([]);
      expect(f.activator.removedMarketplaces).toEqual([]);
      expect(f.machineRepo.records.get(claude)).toBeUndefined();
      expect(f.projectRepo.records.get(claude)?.marketplaces).toEqual([]);
      expect(f.machineRepo.saveCount).toBe(0);
      expect(f.fs.getFile("/foreign/cache/marker.json")).toBe("foreign bytes");
    }
  );

  it.each(["project", "user"] as const)(
    "refuses a newly appearing %s-scope Claude catalogue without a canonical claim even with identical plugin names",
    async (marketplaceScope) => {
      const f = await hostPluginProofFixture(
        { location: "/host/plugins.json", refs: new Map() },
        {
          ...REAL,
          toolId: claude,
          marketplaceScope,
          catalogue: {
            location: "/host/catalogues.json",
            entries: new Map([["same-name", "/foreign/claude"]]),
          },
        }
      );
      const foreignCatalog = JSON.stringify({
        name: "same-name",
        plugins: [{ name: "test-plugin" }],
      });
      f.fs.setFile("/foreign/claude/.claude-plugin/marketplace.json", foreignCatalog);
      const result = await f.sync.execute({ projectRoot: "/A" });
      expect(result.errors).toEqual([]);
      expect(result.warnings.join(" ")).toContain("without a canonical AIDD claim");
      expect(f.projectRepo.records.get(claude)).toMatchObject({
        marketplaces: [],
        pluginRefs: [],
      });
      expect(f.activator.addedMarketplaces).toEqual([]);
      expect(f.activator.enabledPlugins).toEqual([]);
      expect(f.activator.removedMarketplaces).toEqual([]);
      expect(f.machineRepo.records.get(claude)).toBeUndefined();
      expect(f.machineRepo.saveCount).toBe(0);
      expect(f.fs.getFile("/foreign/claude/.claude-plugin/marketplace.json")).toBe(foreignCatalog);
    }
  );

  it("allows fresh Claude registration when the catalogue registry is explicitly absent", async () => {
    const f = await hostPluginProofFixture(
      { location: "/host/plugins.json", absent: true },
      { ...REAL, toolId: claude, catalogue: { location: "/host/catalogues.json", absent: true } }
    );
    const result = await f.sync.execute({ projectRoot: "/A" });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(f.activator.addedMarketplaces).toEqual([`/built/${SYNTHETIC_NATIVE_TOOL}`]);
    expect(f.activator.enabledPlugins).toEqual(["test-plugin@same-name"]);
    expect(f.projectRepo.records.get(claude)?.marketplaces).toEqual([
      {
        alias: "alias",
        hostName: "same-name",
        provenance: { kind: "registry", source: `/built/${SYNTHETIC_NATIVE_TOOL}` },
      },
    ]);
    expect(f.machineRepo.records.get(claude)).toBeUndefined();
  });

  it.each([
    { label: "missing registry reader", reading: undefined, reason: "undefined" },
    {
      label: "unreadable registry with a diagnostic",
      reading: { location: "/host/plugins.json", unreadable: "permission denied" },
      reason: "permission denied",
    },
    {
      label: "unreadable registry without a diagnostic",
      reading: { location: "/host/plugins.json" },
      reason: "/host/plugins.json",
    },
  ])("refuses fresh Codex activation with $label", async ({ reading, reason }) => {
    const f = await hostPluginProofFixture(reading, { ...REAL });
    const result = await f.sync.execute({ projectRoot: "/A" });
    expect(result.warnings.join(" ")).toContain("unreadable host plugin registry");
    expect(result.warnings.join(" ")).toContain(reason);
    expect(f.activator.addedMarketplaces).toEqual([]);
    expect(f.activator.enabledPlugins).toEqual([]);
    expect(f.activator.removedMarketplaces).toEqual([]);
    expect(f.activator.upgradeCount).toBe(0);
    expect(f.projectRepo.records.get(codex)).toMatchObject({
      marketplaces: [],
      pluginRefs: [],
    });
    expect(f.machineRepo.records.get(codex)).toBeUndefined();
    expect(f.machineRepo.saveCount).toBe(0);
    expect(f.fs.getFile("/foreign/cache/marker.json")).toBe("foreign bytes");
  });

  it("accepts an explicitly absent host plugin registry only after proving the newly added source", async () => {
    const f = await hostPluginProofFixture(
      { location: "/host/plugins.json", absent: true },
      { ...REAL }
    );
    const result = await f.sync.execute({ projectRoot: "/A" });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(f.activator.addedMarketplaces).toEqual([`/built/${SYNTHETIC_LISTED_TOOL}`]);
    expect(f.activator.enabledPlugins).toEqual(["test-plugin@same-name"]);
    expect(f.machineRepo.records.get(codex)?.pluginClaims).toEqual([
      { ref: "test-plugin@same-name", dependents: ["/A"] },
    ]);
    expect(f.machineRepo.records.get(codex)?.marketplaces).toEqual([
      {
        alias: "alias",
        hostName: "same-name",
        provenance: {
          kind: "effective-list",
          root: `/built/${SYNTHETIC_LISTED_TOOL}`,
          sourceType: "local",
          source: `/built/${SYNTHETIC_LISTED_TOOL}`,
        },
      },
    ]);
  });
});
