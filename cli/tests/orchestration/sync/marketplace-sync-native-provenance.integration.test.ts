import { describe, expect, it } from "vitest";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_TOOL,
} from "../../shared/testing/synthetic-tool-id.builder.js";
import {
  CACHE_WITNESS,
  CATALOG,
  canonicallyOwned,
  FOREIGN_CATALOG_BYTES,
  FOREIGN_REF,
  HOST_CATALOG_WITNESS,
  makeSync,
  PLUGIN_REF,
  PROJECT_ROOT,
} from "../testing/native-provenance.builder.js";

describe.each([SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL] as const)(
  "%s native marketplace provenance",
  (toolId) => {
    it("leaves a foreign same-name catalogue, ref, and cache untouched", async () => {
      const fixture = makeSync(toolId, {
        conflictOnAdd: true,
        hostRefs: new Map([[FOREIGN_REF, { enabled: true }]]),
      });

      const result = await fixture.useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(fixture.activator.refreshedCatalogs).toEqual([]);
      expect(fixture.activator.removedMarketplaces).toEqual([]);
      expect(fixture.activator.addedMarketplaces).toEqual([]);
      expect(fixture.activator.enabledPlugins).toEqual([]);
      expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
      expect(await fixture.fs.readFile(HOST_CATALOG_WITNESS)).toBe(FOREIGN_CATALOG_BYTES);
      expect(fixture.machineRepo.getCurrent()).toBeNull();
      expect(result.warnings.join("\n")).toContain(CATALOG);
    });

    it("does not even re-add a same-name catalogue carrying a foreign ref", async () => {
      const fixture = makeSync(toolId, {
        hostRefs: new Map([[FOREIGN_REF, { enabled: true }]]),
      });

      const result = await fixture.useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(fixture.activator.addedMarketplaces).toEqual([]);
      expect(fixture.activator.refreshedCatalogs).toEqual([]);
      expect(fixture.activator.enabledPlugins).toEqual([]);
      expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
      expect(await fixture.fs.readFile(HOST_CATALOG_WITNESS)).toBe(FOREIGN_CATALOG_BYTES);
      expect(result.warnings.join("\n")).toContain("legacy claim has no source proof");
    });

    it("refreshes only an exact canonically owned catalogue without foreign refs", async () => {
      const fixture = makeSync(toolId, { machine: canonicallyOwned(toolId) });

      await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(fixture.activator.refreshedCatalogs).toEqual([CATALOG]);
      expect(fixture.activator.enabledPlugins).toEqual([PLUGIN_REF]);
      expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
      expect(await fixture.fs.readFile(HOST_CATALOG_WITNESS)).toBe(fixture.hostCatalogBytes);
    });

    it("attaches A to the exact already-enabled machine claim without re-enabling or changing B's other claim", async () => {
      const machine = canonicallyOwned(toolId);
      const otherRef = "aidd-dev@other-catalog";
      const targetRegistration = {
        alias: CATALOG,
        hostName: CATALOG,
        provenance: {
          kind: "effective-list" as const,
          root: `/built/${toolId}`,
          sourceType: "local",
          source: `/built/${toolId}`,
        },
      };
      const otherRegistration = {
        alias: "other-alias",
        hostName: "other-catalog",
        provenance: {
          kind: "effective-list" as const,
          root: "/other",
          sourceType: "local",
          source: "/other",
        },
      };
      machine.records.set(toolId, {
        binary: toolId,
        marketplaces: [otherRegistration, targetRegistration],
        pluginRefs: [otherRef],
        pluginClaims: [
          { ref: otherRef, dependents: ["/B"] },
          { ref: PLUGIN_REF, dependents: ["/B"] },
        ],
      });
      const fixture = makeSync(toolId, {
        machine,
        hostRefs: new Map([
          [PLUGIN_REF, { enabled: true }],
          [otherRef, { enabled: true }],
          ["user-plugin@external-catalog", { enabled: true }],
        ]),
      });

      const result = await fixture.useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(result.errors).toStrictEqual([]);
      expect(result.warnings).toStrictEqual([]);
      expect(fixture.activator.enabledPlugins).toStrictEqual([]);
      expect(fixture.activator.addedMarketplaces).toStrictEqual([]);
      expect(fixture.activator.removedMarketplaces).toStrictEqual([]);
      expect(fixture.activator.refreshedCatalogs).toStrictEqual([CATALOG]);
      expect(fixture.projectRepo.records.get(toolId)?.pluginRefs).toStrictEqual([PLUGIN_REF]);
      expect(fixture.machineRepo.records.get(toolId)).toStrictEqual({
        binary: toolId,
        marketplaces: [otherRegistration, targetRegistration],
        pluginRefs: [otherRef],
        pluginClaims: [
          { ref: otherRef, dependents: ["/B"] },
          { ref: PLUGIN_REF, dependents: ["/B", PROJECT_ROOT] },
        ],
      });
      expect(fixture.fs.getFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
      expect(fixture.fs.getFile(HOST_CATALOG_WITNESS)).toBe(fixture.hostCatalogBytes);
    });

    it("refuses refresh when a foreign ref shares an AIDD-owned catalogue name", async () => {
      const fixture = makeSync(toolId, {
        machine: canonicallyOwned(toolId),
        hostRefs: new Map([[FOREIGN_REF, { enabled: true }]]),
      });

      const result = await fixture.useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(fixture.activator.refreshedCatalogs).toEqual([]);
      expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
      expect(result.warnings.join("\n")).toContain(FOREIGN_REF);
    });

    it("does not treat a project-only native ref as machine ownership", async () => {
      const fixture = makeSync(toolId, {
        machine: canonicallyOwned(toolId),
        projectNativePluginRefs: [FOREIGN_REF],
        hostRefs: new Map([[FOREIGN_REF, { enabled: true }]]),
      });

      const result = await fixture.useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(fixture.activator.refreshedCatalogs).toEqual([]);
      expect(fixture.activator.addedMarketplaces).toEqual([]);
      expect(fixture.activator.enabledPlugins).toEqual([]);
      expect(fixture.activator.removedMarketplaces).toEqual([]);
      expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
      expect(await fixture.fs.readFile(HOST_CATALOG_WITNESS)).toBe(fixture.hostCatalogBytes);
      expect(result.warnings.join("\n")).toContain(FOREIGN_REF);
    });

    it("activates a freshly added AIDD ref without a redundant refresh", async () => {
      const fixture = makeSync(toolId);

      await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(fixture.activator.addedMarketplaces).toEqual([`/built/${toolId}`]);
      expect(fixture.activator.enabledPlugins).toEqual([PLUGIN_REF]);
      expect(fixture.activator.refreshedCatalogs).toEqual([]);
      expect(fixture.machineRepo.records.get(toolId)?.marketplaces).toEqual([
        {
          alias: CATALOG,
          hostName: CATALOG,
          provenance: {
            kind: "effective-list",
            root: `/built/${toolId}`,
            sourceType: "local",
            source: `/built/${toolId}`,
          },
        },
      ]);
    });
  }
);
