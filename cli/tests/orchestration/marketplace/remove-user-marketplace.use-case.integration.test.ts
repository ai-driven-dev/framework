import { describe, expect, it, vi } from "vitest";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { NativeHostRegistrationGate } from "../../../src/contexts/host-registration/application/native-host-registration-gate.js";
import type { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import {
  REWRITTEN_BINARY,
  spiedRecordRules,
} from "../../contexts/installation/testing/spy-record-rules.fake.js";
import { claimsRecorded } from "../../shared/testing/host-record-reading.builder.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { saying } from "../../shared/testing/saying.builder.js";
import {
  SYNTHETIC_TOOL,
  syntheticCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";
import {
  ALIAS,
  HOST,
  type NativeFixtureOptions,
  nativeFixture,
  options,
  proofFor,
  REF,
} from "../testing/user-marketplace-removal.builder.js";
import { userMarketplaceRemover } from "../testing/user-marketplace-remover.builder.js";

for (const toolId of [SYNTHETIC_TOOL]) {
  describe(`${toolId} targeted user marketplace removal: catalogue selection and claims`, () => {
    const fixture = (
      refs: Parameters<typeof nativeFixture>[1],
      opts: Omit<NativeFixtureOptions, "tools"> = {}
    ) => nativeFixture(toolId, refs, { ...opts, tools: syntheticCatalog() });

    const enabled = () => new Map([[REF, { enabled: true, scope: "user" as const }]]);

    it("refuses the shared framework catalogue before any registry or host access", async () => {
      const f = await fixture(enabled());
      const list = vi.spyOn(f.registry, "list");
      await expect(
        f.useCase.execute({
          ...options(),
          name: FRAMEWORK_MARKETPLACE_NAME,
        })
      ).rejects.toThrow(saying(/shared by every project.*aidd clean --scope user/));
      expect(list).not.toHaveBeenCalled();
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.activator.removedMarketplaces).toEqual([]);
      expect(f.repo.saveCount).toBe(0);
    });

    it("selects the requested user catalogue rather than the first unrelated catalogue", async () => {
      const f = await fixture(enabled());
      const target = (await f.registry.list("/A"))[0];
      if (target === undefined) throw new Error("fixture lacks target catalogue");
      await f.registry.delete("/A", ALIAS, "user");
      const other = Marketplace.create({
        name: "other-alias",
        source: { kind: "github", repo: "other/catalogue" },
        scope: "user",
        addedAt: "2026-09-02T00:00:00.000Z",
      });
      await f.registry.save("/A", other);
      await f.registry.save("/A", target);
      expect((await f.registry.list("/A"))[0]).toEqual(other);
      const deletion = vi.spyOn(f.registry, "delete");
      const hostRemoval = vi.spyOn(f.activator, "removeMarketplace");

      expect(await f.useCase.execute(options())).toMatchObject({
        marketplace: { name: ALIAS, scope: "user" },
        removedPluginCount: 1,
      });
      expect(deletion).toHaveBeenCalledExactlyOnceWith("/A", ALIAS, "user");
      expect(hostRemoval).toHaveBeenCalledExactlyOnceWith(HOST, "user");
      expect(await f.registry.list("/A")).toEqual([other]);
      expect(f.repo.saveCount).toBe(1);
    });

    it("defaults native uninstall to user only when the proven host ref has no scope", async () => {
      const f = await fixture(new Map([[REF, { enabled: true }]]));
      await f.useCase.execute(options());
      expect(f.activator.uninstalledPlugins).toEqual([REF]);
      expect(f.activator.uninstalledPluginScopes).toEqual(["user"]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([]);
    });

    it("writes the record the host rewrote once the catalogue is withdrawn", async () => {
      const spy = spiedRecordRules();
      const f = await fixture(enabled(), { records: spy.rules });
      const before = structuredClone(f.repo.getCurrent()?.getNativeRegistrations(toolId));

      await f.useCase.execute(options());

      expect(spy.withoutMarketplace).toHaveBeenCalledExactlyOnceWith(before, ALIAS);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)).toStrictEqual({
        ...before,
        binary: REWRITTEN_BINARY,
      });
    });

    it("removes a proven empty catalogue without inventing missing plugin claims", async () => {
      const f = await fixture(new Map());
      f.repo.getCurrent()?.setNativeRegistrations(toolId, {
        binary: toolId,
        marketplaces: [{ alias: ALIAS, hostName: HOST, provenance: proofFor() }],
        pluginRefs: [],
      });
      expect(await f.useCase.execute(options())).toMatchObject({ removedPluginCount: 0 });
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.activator.removedMarketplaces).toEqual([HOST]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)).toMatchObject({
        marketplaces: [],
        pluginRefs: [],
        pluginClaims: [],
      });
      expect(await f.registry.list("/A")).toEqual([]);
    });

    it("refuses catalogue deletion when the canonical user ledger is missing", async () => {
      const f = await fixture(enabled());
      const before = await f.registry.list("/A");
      await f.repo.delete();
      await expect(f.useCase.execute(options())).rejects.toThrow(/no user manifest/);
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.activator.removedMarketplaces).toEqual([]);
      expect(await f.registry.list("/A")).toEqual(before);
      expect(f.repo.saveCount).toBe(0);
    });

    it("refuses B's live claim, including with autoConfirm", async () => {
      const f = await fixture(enabled(), { dependents: ["/B"] });
      await expect(f.useCase.execute(options())).rejects.toThrow(
        saying(/user-scope marketplace 'project-alias'.*active projects.*\/B/)
      );
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(
        claimsRecorded(f.repo.getCurrent()?.getNativeRegistrations(toolId))[0]?.dependents
      ).toEqual(["/B"]);
    });

    it("never treats a project-scope catalogue with the same alias as a user-scope target", async () => {
      const f = await fixture(enabled());
      await f.registry.save(
        "/A",
        Marketplace.create({
          name: ALIAS,
          source: { kind: "github", repo: "ai-driven-dev/framework" },
          scope: "project",
          addedAt: "2026-09-02T00:00:00.000Z",
        })
      );
      await expect(f.useCase.execute(options())).rejects.toThrow(
        expect.objectContaining({ marketplace: ALIAS })
      );
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.activator.removedMarketplaces).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: REF, dependents: [] },
      ]);
    });

    it("rechecks the user catalogue source after taking the machine lock", async () => {
      const f = await fixture(enabled());
      const lockedRepo = {
        path: f.repo.path,
        load: () => f.repo.load(),
        save: (manifest: Manifest) => f.repo.save(manifest),
        delete: () => f.repo.delete(),
        withExclusiveAccess: async <T>(action: () => Promise<T>): Promise<T> => {
          await f.registry.save(
            "/A",
            Marketplace.create({
              name: ALIAS,
              source: { kind: "github", repo: "foreign/changed" },
              scope: "user",
              addedAt: "2026-09-02T00:00:00.000Z",
            })
          );
          return action();
        },
      };
      const useCase = userMarketplaceRemover(
        syntheticCatalog(),
        new InMemoryFileAdapter(),
        lockedRepo,
        f.registry,
        new NativeHostRegistrationGate(new Map([[toolId, f.activator]]), new Map())
      );
      await expect(useCase.execute(options())).rejects.toThrow(
        /changed while waiting for the machine lock/
      );
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: REF, dependents: [] },
      ]);
    });
  });
}
