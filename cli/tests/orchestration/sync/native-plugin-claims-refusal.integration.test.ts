import { describe, expect, it } from "vitest";
import type { HostPluginRegistry } from "../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { claimsRecorded } from "../../shared/testing/host-record-reading.builder.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { saying } from "../../shared/testing/saying.builder.js";
import {
  SYNTHETIC_LISTED_CATALOGUE,
  SYNTHETIC_LISTED_TOOL,
  SYNTHETIC_PROVEN_CATALOGUE,
  SYNTHETIC_PROVEN_TOOL,
  syntheticSyncCatalog,
} from "../../shared/testing/synthetic-native-tool.builder.js";
import { effectiveListSources } from "../testing/effective-list-sources.builder.js";
import { userScopeCleaner } from "../testing/user-scope-cleaner.builder.js";

for (const [toolId, catalogPath] of [
  [SYNTHETIC_LISTED_TOOL, SYNTHETIC_LISTED_CATALOGUE],
  [SYNTHETIC_PROVEN_TOOL, SYNTHETIC_PROVEN_CATALOGUE],
] as const) {
  describe(`${toolId} machine plugin claims`, () => {
    it("global clean refuses live plugin dependents and preserves claims if host unregister fails", async () => {
      const ref = "test-plugin@real-catalog";
      const machine = Manifest.create();
      machine.addTool(toolId, "1.0.0", []);
      const repo = new InMemoryManifestRepository(machine);
      repo.records.set(toolId, {
        binary: toolId,
        marketplaces: [
          {
            alias: "local-alias",
            hostName: "real-catalog",
            provenance: {
              kind: "effective-list",
              root: `/built/${toolId}`,
              sourceType: "local",
              source: `/built/${toolId}`,
            },
          },
        ],
        pluginRefs: [ref],
        pluginClaims: [{ ref, dependents: ["/B"] }],
      });
      const fs = new InMemoryFileAdapter(
        {
          [`/built/${toolId}/${catalogPath}`]: JSON.stringify({
            name: "real-catalog",
            plugins: [],
          }),
        },
        ["/A", "/B"]
      );
      const registry = new InMemoryMarketplaceRegistry();
      const failing = new FakeHostActions({ available: true, failOnUninstall: [ref] });
      const sources = effectiveListSources(toolId, "real-catalog", `/built/${toolId}`);
      const hostPlugins = new Map<AiToolId, HostPluginRegistry>([
        [
          toolId,
          {
            read: async () => ({
              location: `/host/${toolId}/plugins`,
              refs: new Map([[ref, { enabled: true, scope: "user" as const }]]),
            }),
          },
        ],
      ]);
      const clean = userScopeCleaner({
        tools: syntheticSyncCatalog(),
        fs,
        repo,
        marketplaceRegistry: registry,
        userConfigDir: () => "/machine",
        activators: new Map([[toolId, failing]]),
        homeDir: () => "/home",
        sources,
        pluginRegistries: hostPlugins,
      });
      await expect(clean.execute({ projectRoot: "/B", force: true })).rejects.toThrow(
        saying(/active projects.*\/B/)
      );
      expect(failing.uninstalledPlugins).toEqual([]);
      expect(claimsRecorded(repo.records.get(toolId))[0]?.dependents).toEqual(["/B"]);
      const registrations = repo.records.get(toolId);
      if (registrations === undefined) throw new Error("seeded machine claim missing");
      repo.records.set(toolId, {
        ...registrations,
        pluginClaims: [{ ref, dependents: [] }],
      });
      await expect(clean.execute({ projectRoot: "/B", force: true })).rejects.toThrow(
        /uninstall.*failed.*claims retained/
      );
      expect(repo.records.get(toolId)?.pluginClaims).toEqual([{ ref, dependents: [] }]);
      const working = new FakeHostActions({ available: true });
      const finish = userScopeCleaner({
        tools: syntheticSyncCatalog(),
        fs,
        repo,
        marketplaceRegistry: registry,
        userConfigDir: () => "/machine",
        activators: new Map([[toolId, working]]),
        homeDir: () => "/home",
        sources,
        pluginRegistries: hostPlugins,
      });
      await finish.execute({ projectRoot: "/B", force: true });
      expect(working.uninstalledPlugins).toEqual([ref]);
      expect(working.removedMarketplaces).toEqual(["real-catalog"]);
      expect(repo.getCurrent()).toBeNull();
    });
  });
}
