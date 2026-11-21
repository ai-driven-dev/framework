import { describe, expect, it } from "vitest";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { hostPluginProofFixture } from "../testing/source-provenance.builder.js";

const { claude, codex } = TOOL;

describe("native catalogue source provenance", () => {
  it.each(["project", "user"] as const)(
    "refuses a %s-scope Claude catalogue if its registry becomes unreadable after the source check",
    async (marketplaceScope) => {
      const f = await hostPluginProofFixture(
        { location: "/host/plugins.json", refs: new Map() },
        {
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
      expect(f.machineRepo.getCurrent()?.getNativeRegistrations(claude)).toBeUndefined();
      expect(f.projectRepo.getCurrent()?.getNativeRegistrations(claude)?.marketplaces).toEqual([]);
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
      expect(f.projectRepo.getCurrent()?.getNativeRegistrations(claude)).toMatchObject({
        marketplaces: [],
        pluginRefs: [],
      });
      expect(f.activator.addedMarketplaces).toEqual([]);
      expect(f.activator.enabledPlugins).toEqual([]);
      expect(f.activator.removedMarketplaces).toEqual([]);
      expect(f.machineRepo.getCurrent()?.getNativeRegistrations(claude)).toBeUndefined();
      expect(f.machineRepo.saveCount).toBe(0);
      expect(f.fs.getFile("/foreign/claude/.claude-plugin/marketplace.json")).toBe(foreignCatalog);
    }
  );

  it("allows fresh Claude registration when the catalogue registry is explicitly absent", async () => {
    const f = await hostPluginProofFixture(
      { location: "/host/plugins.json", absent: true },
      { toolId: claude, catalogue: { location: "/host/catalogues.json", absent: true } }
    );
    const result = await f.sync.execute({ projectRoot: "/A" });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(f.activator.addedMarketplaces).toEqual(["/built/claude"]);
    expect(f.activator.enabledPlugins).toEqual(["test-plugin@same-name"]);
    expect(f.projectRepo.getCurrent()?.getNativeRegistrations(claude)?.marketplaces).toEqual([
      {
        alias: "alias",
        hostName: "same-name",
        provenance: { kind: "registry", source: "/built/claude" },
      },
    ]);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations(claude)).toBeUndefined();
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
    const f = await hostPluginProofFixture(reading);
    const result = await f.sync.execute({ projectRoot: "/A" });
    expect(result.warnings.join(" ")).toContain("unreadable host plugin registry");
    expect(result.warnings.join(" ")).toContain(reason);
    expect(f.activator.addedMarketplaces).toEqual([]);
    expect(f.activator.enabledPlugins).toEqual([]);
    expect(f.activator.removedMarketplaces).toEqual([]);
    expect(f.activator.upgradeCount).toBe(0);
    expect(f.projectRepo.getCurrent()?.getNativeRegistrations(codex)).toMatchObject({
      marketplaces: [],
      pluginRefs: [],
    });
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations(codex)).toBeUndefined();
    expect(f.machineRepo.saveCount).toBe(0);
    expect(f.fs.getFile("/foreign/cache/marker.json")).toBe("foreign bytes");
  });

  it("accepts an explicitly absent host plugin registry only after proving the newly added source", async () => {
    const f = await hostPluginProofFixture({ location: "/host/plugins.json", absent: true });
    const result = await f.sync.execute({ projectRoot: "/A" });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(f.activator.addedMarketplaces).toEqual(["/built/codex"]);
    expect(f.activator.enabledPlugins).toEqual(["test-plugin@same-name"]);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
      { ref: "test-plugin@same-name", dependents: ["/A"] },
    ]);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations(codex)?.marketplaces).toEqual([
      {
        alias: "alias",
        hostName: "same-name",
        provenance: {
          kind: "effective-list",
          root: "/built/codex",
          sourceType: "local",
          source: "/built/codex",
        },
      },
    ]);
  });
});
