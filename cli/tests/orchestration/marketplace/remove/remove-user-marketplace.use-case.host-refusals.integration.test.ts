import { describe, expect, it } from "vitest";
import type { MarketplaceRegistry } from "../../../../src/contexts/distribution/ports/marketplace-registry.js";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { hostRecord } from "../../../shared/testing/host-record-reading.builder.js";
import { hostWithdrawal } from "../../../shared/testing/host-withdrawal.builder.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../shared/testing/in-memory-manifest-repository.fake.js";
import {
  SYNTHETIC_NATIVE_TOOL,
  syntheticNativeFamilyCatalog,
} from "../../../shared/testing/synthetic-native-tool.builder.js";
import {
  ALIAS,
  HOST,
  type NativeFixtureOptions,
  nativeFixture,
  options,
  REF,
  sourceReader,
} from "../../testing/user-marketplace-removal.builder.js";
import { userMarketplaceRemover } from "../../testing/user-marketplace-remover.builder.js";

for (const toolId of [SYNTHETIC_NATIVE_TOOL]) {
  describe(`${toolId} targeted user marketplace removal: host refusals and retries`, () => {
    const fixture = (
      refs: Parameters<typeof nativeFixture>[1],
      opts: Omit<NativeFixtureOptions, "tools"> = {}
    ) => nativeFixture(toolId, refs, { ...opts, tools: syntheticNativeFamilyCatalog() });

    const enabled = () => new Map([[REF, { enabled: true, scope: "user" as const }]]);

    it("requires a canonical user manifest before uninstalling any host ref", async () => {
      const f = await fixture(enabled());
      const absent = new InMemoryManifestRepository();
      const useCase = userMarketplaceRemover(
        syntheticNativeFamilyCatalog(),
        new InMemoryFileAdapter(),
        absent,
        f.registry,
        hostWithdrawal(new Map([[toolId, f.activator]]), new Map())
      );
      await expect(useCase.execute(options())).rejects.toThrow(/no user manifest/);
      expect(f.activator.uninstalledPlugins).toEqual([]);
    });

    it("refuses a foreign ref in the same host catalogue without mutating either ref", async () => {
      const refs = new Map([
        ...enabled(),
        [`foreign@${HOST}`, { enabled: true, scope: "user" as const }],
      ]);
      const f = await fixture(refs);
      await expect(f.useCase.execute(options())).rejects.toThrow(
        /foreign host ref.*foreign@real-catalog/
      );
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.activator.removedMarketplaces).toEqual([]);
      expect(f.repo.records.get(toolId)?.pluginClaims).toEqual([{ ref: REF, dependents: [] }]);
    });

    it("refuses an unreadable host registry before any host mutation", async () => {
      const f = await fixture(enabled());
      const unreadable = hostWithdrawal(
        new Map([[toolId, f.activator]]),
        new Map([
          [
            toolId,
            { read: async () => ({ location: "/host/registry", unreadable: "permission denied" }) },
          ],
        ]),
        new Map([[toolId, sourceReader()]])
      );
      const useCase = userMarketplaceRemover(
        syntheticNativeFamilyCatalog(),
        new InMemoryFileAdapter(),
        f.repo,
        f.registry,
        unreadable
      );
      await expect(useCase.execute(options())).rejects.toThrow(/host plugin registry unreadable/);
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.repo.records.get(toolId)?.pluginClaims).toEqual([{ ref: REF, dependents: [] }]);
    });

    it("refuses an unavailable host CLI", async () => {
      const f = await fixture(enabled(), { available: false });
      await expect(f.useCase.execute(options())).rejects.toThrow(
        /CLI or host registry unavailable/
      );
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.repo.records.get(toolId)?.pluginClaims).toEqual([{ ref: REF, dependents: [] }]);
    });

    it("refuses a missing or disabled owned ref", async () => {
      for (const refs of [
        new Map(),
        new Map([[REF, { enabled: false, scope: "user" as const }]]),
      ]) {
        const f = await fixture(refs);
        await expect(f.useCase.execute(options())).rejects.toThrow(/still enabled/);
        expect(f.activator.uninstalledPlugins).toEqual([]);
        expect(f.repo.records.get(toolId)?.pluginClaims).toEqual([{ ref: REF, dependents: [] }]);
      }
    });

    it("keeps the canonical claim and registry if the host refuses unregister", async () => {
      const f = await fixture(enabled(), { failOnUninstall: true });
      await expect(f.useCase.execute(options())).rejects.toThrow(
        expect.objectContaining({ detail: expect.stringMatching(/not installed/) })
      );
      expect(f.repo.records.get(toolId)?.pluginClaims).toEqual([{ ref: REF, dependents: [] }]);
      expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeDefined();
      expect(f.activator.removedMarketplaces).toEqual([]);
    });

    it("retains the claim and catalogue record if catalogue removal fails after ref uninstall", async () => {
      const f = await fixture(enabled(), { throwOnRemove: true });
      await expect(f.useCase.execute(options())).rejects.toThrow(
        expect.objectContaining({ detail: expect.stringMatching(/marketplace remove.*failed/) })
      );
      expect(f.activator.uninstalledPlugins).toEqual([REF]);
      expect(f.repo.records.get(toolId)?.pluginClaims).toEqual([{ ref: REF, dependents: [] }]);
      expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeDefined();
    });

    it("retains the machine claim if the local catalogue registry refuses deletion", async () => {
      const f = await fixture(enabled());
      const registry: MarketplaceRegistry = {
        list: (root) => f.registry.list(root),
        save: (root, marketplace) => f.registry.save(root, marketplace),
        delete: async () => {
          throw new Error("registry delete failed");
        },
        updateLastFetched: (root, key, when) => f.registry.updateLastFetched(root, key, when),
        updateVersion: (root, key, version) => f.registry.updateVersion(root, key, version),
      };
      const useCase = userMarketplaceRemover(
        syntheticNativeFamilyCatalog(),
        new InMemoryFileAdapter(),
        {
          path: f.repo.path,
          load: async () => {
            const current = await f.repo.load();
            return current === null
              ? null
              : Manifest.fromJSON(current.toJSON(), (raw) =>
                  syntheticNativeFamilyCatalog().toolId(raw)
                );
          },
          loadIfReadable: async () => null,
          save: (manifest) => f.repo.save(manifest),
          delete: () => f.repo.delete(),
          loadRecords: () => f.repo.loadRecords(),
          saveRecords: (records) => f.repo.saveRecords(records),
          withExclusiveAccess: (action) => action(),
        },
        registry,
        hostWithdrawal(
          new Map([[toolId, f.activator]]),
          new Map([
            [toolId, { read: async () => ({ location: "/host/registry", refs: enabled() }) }],
          ]),
          new Map([[toolId, sourceReader()]])
        )
      );
      await expect(useCase.execute(options())).rejects.toThrow(/registry delete failed/);
      expect(f.repo.records.get(toolId)?.pluginClaims).toEqual([{ ref: REF, dependents: [] }]);
      expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeDefined();
    });

    it("unregisters the exact ref and real host catalogue after B detaches", async () => {
      const f = await fixture(enabled());
      expect(await f.useCase.execute(options())).toMatchObject({ removedPluginCount: 1 });
      expect(f.activator.uninstalledPlugins).toEqual([REF]);
      expect(f.activator.uninstalledPluginScopes).toEqual(["user"]);
      expect(f.activator.removedMarketplaces).toEqual([HOST]);
      expect(f.repo.records.get(toolId)?.pluginClaims).toEqual([]);
      expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeUndefined();
    });

    it("uses the host's recorded ref scope rather than guessing user for native uninstall", async () => {
      const f = await fixture(new Map([[REF, { enabled: true, scope: "project" as const }]]));
      await f.useCase.execute(options());
      expect(f.activator.uninstalledPlugins).toEqual([REF]);
      expect(f.activator.uninstalledPluginScopes).toEqual(["project"]);
      expect(f.activator.removedMarketplaces).toEqual([HOST]);
      expect(f.repo.records.get(toolId)?.pluginClaims).toEqual([]);
    });

    it("preserves a different canonical host catalogue and its dependent ref", async () => {
      const f = await fixture(enabled());
      const registration = hostRecord(f.repo.records.get(toolId));
      expect(registration).toBeDefined();
      if (registration === undefined) throw new Error("fixture lacks registry");
      f.repo.records.set(toolId, {
        ...registration,
        marketplaces: [
          ...registration.marketplaces,
          { alias: "other-alias", hostName: "other-catalog" },
        ],
        pluginRefs: [...registration.pluginRefs, "other-plugin@other-catalog"],
        pluginClaims: [
          ...(registration.pluginClaims ?? []),
          { ref: "other-plugin@other-catalog", dependents: ["/B"] },
        ],
      });
      expect(await f.useCase.execute(options())).toMatchObject({ removedPluginCount: 1 });
      expect(f.activator.uninstalledPlugins).toEqual([REF]);
      expect(f.activator.removedMarketplaces).toEqual([HOST]);
      expect(f.repo.records.get(toolId)?.pluginClaims).toEqual([
        { ref: "other-plugin@other-catalog", dependents: ["/B"] },
      ]);
      expect(f.repo.records.get(toolId)?.pluginRefs).toEqual(["other-plugin@other-catalog"]);
      expect(f.repo.records.get(toolId)?.marketplaces).toEqual([
        { alias: "other-alias", hostName: "other-catalog" },
      ]);
    });
  });
}
