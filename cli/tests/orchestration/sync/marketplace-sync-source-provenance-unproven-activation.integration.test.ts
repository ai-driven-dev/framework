import { describe, expect, it } from "vitest";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { hostRecord } from "../../shared/testing/host-record-reading.builder.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import {
  SYNTHETIC_LISTED_CATALOGUE,
  SYNTHETIC_LISTED_TOOL,
  SYNTHETIC_PROVEN_CATALOGUE,
  SYNTHETIC_PROVEN_TOOL,
  syntheticSyncCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";
import {
  catalogueFilesystem,
  codexSourceAfterAdd,
  foreignCacheFilesystem,
  type PostAddProof,
  projectDeclaring,
  registryWithAlias,
  syncOfDeclaredPlugin,
} from "../testing/source-provenance.builder.js";

const codex = SYNTHETIC_LISTED_TOOL;
const copilot = SYNTHETIC_PROVEN_TOOL;

const CODEX_CATALOGUE = `/built/${SYNTHETIC_LISTED_TOOL}/${SYNTHETIC_LISTED_CATALOGUE}`;
const ENABLED_REF = "test-plugin@same-name";
const CODEX_SOURCE = {
  kind: "effective-list",
  root: `/built/${SYNTHETIC_LISTED_TOOL}`,
  sourceType: "local",
  source: `/built/${SYNTHETIC_LISTED_TOOL}`,
} as const;

async function codexProject(projectRoot: string) {
  return {
    projectRepo: new InMemoryManifestRepository(projectDeclaring(codex)),
    registry: await registryWithAlias(projectRoot),
  };
}

describe("native catalogue activation refused until the host source is proven", () => {
  it.each([
    "foreign source",
    "foreign root",
    "non-local source type",
    "unreadable",
    "missing catalogue",
    "unproven catalogue",
  ] as const satisfies readonly PostAddProof[])(
    "keeps foreign bytes and records no claim or enablement when post-add Codex proof is %s",
    async (proof) => {
      const { projectRepo, registry } = await codexProject("/A");
      const machineRepo = new InMemoryManifestRepository(Manifest.create());
      const fs = foreignCacheFilesystem(CODEX_CATALOGUE);
      const activator = new FakeHostActions({ available: true });
      const sync = syncOfDeclaredPlugin({
        tools: syntheticSyncCatalog(),
        toolId: codex,
        fs,
        projectRepo,
        machineRepo,
        registry,
        activator,
        source: codexSourceAfterAdd(activator, proof),
      });
      const result = await sync.execute({ projectRoot: "/A" });
      expect(result.warnings.join(" ")).toMatch(
        /post-add|add returned.*effective host source.*reconcile manually/i
      );
      expect(activator.addedMarketplaces).toEqual([`/built/${SYNTHETIC_LISTED_TOOL}`]);
      expect(activator.enabledPlugins).toEqual([]);
      expect(machineRepo.getCurrent()?.getNativeRegistrations(codex)).toBeUndefined();
      expect(
        projectRepo.getCurrent()?.getNativeRegistrations(codex)?.marketplaces ?? []
      ).toStrictEqual([]);
      expect(
        projectRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginRefs ?? []
      ).toStrictEqual([]);
      expect(activator.removedMarketplaces).toStrictEqual([]);
      expect(activator.upgradeCount).toBe(0);
      expect(await fs.readFile("/foreign/cache/marker.json")).toBe("foreign bytes");
    }
  );

  it.each([
    {
      label: "unreadable CLI source",
      reading: {
        location: "copilot plugin marketplace list --json",
        unreadable:
          "Copilot CLI marketplace list --json unavailable; upgrade to a supported binary and retry",
      },
      reason: "Copilot CLI marketplace list --json unavailable",
    },
    {
      label: "foreign effective source",
      reading: {
        location: "copilot effective marketplace list",
        entries: new Map([
          [
            "same-name",
            {
              kind: "effective-list" as const,
              root: "/foreign",
              sourceType: "local",
              source: "/foreign",
            },
          ],
        ]),
      },
      reason: "host source unproven",
    },
  ])(
    "refuses Copilot activation with $label without changing declarative settings",
    async ({ reading, reason }) => {
      const projectRoot = "/A";
      const projectRepo = new InMemoryManifestRepository(projectDeclaring(copilot));
      const machineRepo = new InMemoryManifestRepository(Manifest.create());
      const registry = await registryWithAlias(projectRoot);
      const fs = catalogueFilesystem(
        `/built/${SYNTHETIC_PROVEN_TOOL}/${SYNTHETIC_PROVEN_CATALOGUE}`
      );
      const settingsPath = `${projectRoot}/.github/copilot/settings.json`;
      const foreignSettings = JSON.stringify({
        enabledPlugins: { "foreign@foreign-catalog": true },
        extraKnownMarketplaces: { "foreign-catalog": { source: "github" } },
      });
      fs.setFile(settingsPath, foreignSettings);
      const activator = new FakeHostActions({ available: true });
      const source: HostMarketplaceSources = { read: async () => reading };
      const sync = syncOfDeclaredPlugin({
        tools: syntheticSyncCatalog(),
        toolId: copilot,
        fs,
        projectRepo,
        machineRepo,
        registry,
        activator,
        source,
      });
      const result = await sync.execute({ projectRoot });
      expect(result.warnings.join(" ")).toContain(reason);
      expect(activator.addedMarketplaces).toEqual([]);
      expect(activator.enabledPlugins).toEqual([]);
      expect(activator.upgradeCount).toBe(0);
      expect(machineRepo.getCurrent()?.getNativeRegistrations(copilot)).toBeUndefined();
      expect(await fs.readFile(settingsPath)).toBe(foreignSettings);
    }
  );

  it("claims a fresh Codex source after post-read and attaches B without replacing it", async () => {
    const { projectRepo, registry } = await codexProject("/A");
    const machineRepo = new InMemoryManifestRepository(Manifest.create());
    const fs = catalogueFilesystem(CODEX_CATALOGUE);
    const activator = new FakeHostActions({ available: true });
    const source: HostMarketplaceSources = {
      read: async () => ({
        location: "host",
        entries:
          activator.addedMarketplaces.length === 0
            ? new Map()
            : new Map([["same-name", CODEX_SOURCE]]),
      }),
    };
    const sync = syncOfDeclaredPlugin({
      tools: syntheticSyncCatalog(),
      toolId: codex,
      fs,
      projectRepo,
      machineRepo,
      registry,
      activator,
      source,
    });
    const result = await sync.execute({ projectRoot: "/A" });
    expect(result.errors).toEqual([]);
    expect(activator.addedMarketplaces).toEqual([`/built/${SYNTHETIC_LISTED_TOOL}`]);
    expect(activator.enabledPlugins).toEqual([ENABLED_REF]);
    expect(
      hostRecord(machineRepo.getCurrent()?.getNativeRegistrations(codex))?.marketplaces[0]
        .provenance
    ).toEqual(CODEX_SOURCE);
    const { projectRepo: projectB, registry: registryB } = await codexProject("/B");
    const syncB = syncOfDeclaredPlugin({
      tools: syntheticSyncCatalog(),
      toolId: codex,
      fs,
      projectRepo: projectB,
      machineRepo,
      registry: registryB,
      activator,
      source,
      pluginRefs: new Map([[ENABLED_REF, { enabled: true }]]),
    });
    await syncB.execute({ projectRoot: "/B" });
    expect(activator.addedMarketplaces).toEqual([`/built/${SYNTHETIC_LISTED_TOOL}`]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
      { ref: ENABLED_REF, dependents: ["/A", "/B"] },
    ]);
  });
});
