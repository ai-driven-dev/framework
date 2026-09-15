import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { CleanUserScopeUseCase } from "../../../../../src/contexts/framework/application/clean/clean-user-scope-use-case.js";
import { MarketplaceSyncSettingsUseCase } from "../../../../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import { NativeHostRegistrationGate } from "../../../../../src/contexts/framework/application/ownership/native-host-registration-gate.js";
import { UserMarketplaceRemoveUseCase } from "../../../../../src/contexts/framework/application/ownership/user-marketplace-remove-use-case.js";
import { UserPluginDistributionLoader } from "../../../../../src/contexts/framework/application/ownership/user-plugin-distribution-loader.js";
import { UserPluginFileUpdater } from "../../../../../src/contexts/framework/application/ownership/user-plugin-file-updater.js";
import { UserPluginUpdateUseCase } from "../../../../../src/contexts/framework/application/ownership/user-plugin-update-use-case.js";
import { PluginRemoveUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-remove-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginDistributionReaderAdapter } from "../../../../../src/contexts/framework/infrastructure/plugin-distribution-reader-adapter.js";
import type { HostPluginRegistryReader } from "../../../../../src/contexts/tools/domain/ports/host-plugin-registry-reader.js";
import { nativeActivationOf } from "../../../../../src/contexts/tools/domain/registry.js";
import { resolveHomeDir } from "../../../../../src/kernel/reading/home-dir.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { FixturePluginFetcher } from "../../../../helpers/ports/fixture-plugin-fetcher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

for (const [toolId, catalogPath] of [
  ["codex", ".agents/plugins/marketplace.json"],
  ["copilot", ".plugin/marketplace.json"],
] as const) {
  describe(`${toolId} machine plugin claims`, () => {
    it("global clean refuses live plugin dependents and preserves claims if host unregister fails", async () => {
      const ref = "test-plugin@real-catalog";
      const machine = Manifest.create();
      machine.addTool(toolId, "1.0.0", []);
      machine.setNativeRegistrations(toolId, {
        binary: toolId,
        marketplaces: [{ alias: "local-alias", hostName: "real-catalog" }],
        pluginRefs: [ref],
        pluginClaims: [{ ref, dependents: ["/B"] }],
      });
      const repo = new InMemoryManifestRepository(machine);
      const fs = new InMemoryFileAdapter();
      const registry = new InMemoryMarketplaceRegistry();
      const failing = new FakeNativePluginActivator({ available: true, failOnUninstall: [ref] });
      const clean = new CleanUserScopeUseCase(
        fs,
        repo,
        new CapturingLogger(),
        registry,
        () => "/machine",
        new Map([[toolId, failing]]),
        new Map(),
        () => "/home"
      );
      await expect(clean.execute({ projectRoot: "/B", force: true })).rejects.toThrow(
        /active projects.*\/B/
      );
      expect(failing.uninstalledPlugins).toEqual([]);
      expect(
        repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims?.[0]?.dependents
      ).toEqual(["/B"]);
      machine.setNativeRegistrations(toolId, {
        ...machine.getNativeRegistrations(toolId)!,
        pluginClaims: [{ ref, dependents: [] }],
      });
      await repo.save(machine);
      await expect(clean.execute({ projectRoot: "/B", force: true })).rejects.toThrow(
        /uninstall.*failed.*claims retained/
      );
      expect(repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref, dependents: [] },
      ]);
      const working = new FakeNativePluginActivator({ available: true });
      const finish = new CleanUserScopeUseCase(
        fs,
        repo,
        new CapturingLogger(),
        registry,
        () => "/machine",
        new Map([[toolId, working]]),
        new Map(),
        () => "/home"
      );
      await finish.execute({ projectRoot: "/B", force: true });
      expect(working.uninstalledPlugins).toEqual([ref]);
      expect(working.removedMarketplaces).toEqual(["real-catalog"]);
      expect(repo.getCurrent()).toBeNull();
    });
    it("attaches B to AIDD's exact host ref without re-enabling it, but never claims a foreign ref", async () => {
      const alias = "local-alias";
      const hostName = "real-catalog";
      const ref = `test-plugin@${hostName}`;
      const builtDir = `/built/${toolId}`;
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        "/A",
        Marketplace.create({
          name: alias,
          source: { kind: "local", path: "/src" },
          scope: "user",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      const project = (root: string) => {
        const manifest = Manifest.create();
        manifest.addTool(toolId, "1.0.0", []);
        manifest.addPlugin(
          toolId,
          InstalledPlugin.fromMetadata(
            "test-plugin",
            "1.0.0",
            { kind: "local", path: "/src" },
            false,
            "project",
            alias
          )
        );
        return new InMemoryManifestRepository(manifest);
      };
      const a = project("/A");
      const b = project("/B");
      const foreign = project("/foreign");
      const user = new InMemoryManifestRepository(Manifest.create());
      const activator = new FakeNativePluginActivator({ available: true });
      let enabled = false;
      const hostReader: HostPluginRegistryReader = {
        read: async () => ({
          location: "/host/registry",
          refs: new Map(enabled ? [[ref, { enabled: true, scope: "user" as const }]] : []),
        }),
      };
      const useCase = new MarketplaceSyncSettingsUseCase(
        new InMemoryFileAdapter({
          [`${builtDir}/${catalogPath}`]: JSON.stringify({
            name: hostName,
            version: "1.0.0",
            plugins: [],
          }),
        }),
        a,
        registry,
        new DeterministicHasher(),
        new CapturingLogger(),
        new Map([[toolId, activator]]),
        fakeEnsureBuiltMarketplace(() => builtDir),
        new Map(),
        () => "/built",
        undefined,
        undefined,
        undefined,
        new Map([[toolId, hostReader]]),
        user
      );

      await useCase.execute({ projectRoot: "/A", manifestRepo: a, toolIds: [toolId] });
      enabled = true;
      await useCase.execute({ projectRoot: "/B", manifestRepo: b, toolIds: [toolId] });
      expect(activator.enabledPlugins).toEqual([ref]);
      expect(b.getCurrent()?.getNativeRegistrations(toolId)?.pluginRefs).toContain(ref);
      expect(user.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref, dependents: ["/A", "/B"] },
      ]);
      const updateFs = new InMemoryFileAdapter();
      const update = new UserPluginUpdateUseCase(
        user,
        new UserPluginFileUpdater(
          updateFs,
          new UserPluginDistributionLoader(
            new FixturePluginFetcher(),
            new PluginDistributionReaderAdapter(updateFs)
          ),
          new DeterministicHasher()
        ),
        new CapturingLogger(),
        new NativeHostRegistrationGate(
          new Map([[toolId, activator]]),
          new Map([[toolId, hostReader]])
        )
      );
      if (toolId === "copilot") {
        expect(
          await update.execute({
            pluginNames: ["test-plugin"],
            toolIds: [toolId],
            projectRoot: "/A",
            scope: "user",
          })
        ).toEqual([ref]);
        expect(activator.updatedPlugins).toEqual([ref]);
        const failed = new FakeNativePluginActivator({ available: true, failOnUpdate: [ref] });
        const failingUpdate = new UserPluginUpdateUseCase(
          user,
          new UserPluginFileUpdater(
            updateFs,
            new UserPluginDistributionLoader(
              new FixturePluginFetcher(),
              new PluginDistributionReaderAdapter(updateFs)
            ),
            new DeterministicHasher()
          ),
          new CapturingLogger(),
          new NativeHostRegistrationGate(
            new Map([[toolId, failed]]),
            new Map([[toolId, hostReader]])
          )
        );
        await expect(
          failingUpdate.execute({
            pluginNames: ["test-plugin"],
            toolIds: [toolId],
            projectRoot: "/A",
            scope: "user",
          })
        ).rejects.toThrow(/plugin update.*failed/);
        expect(user.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
          { ref, dependents: ["/A", "/B"] },
        ]);
      } else {
        await expect(
          update.execute({
            pluginNames: ["test-plugin"],
            toolIds: [toolId],
            projectRoot: "/A",
            scope: "user",
          })
        ).rejects.toThrow(/does not support targeted.*update/);
        expect(activator.updatedPlugins).toEqual([]);
      }
      const removeMarketplace = new UserMarketplaceRemoveUseCase(
        new InMemoryFileAdapter(),
        user,
        registry,
        new NativeHostRegistrationGate(
          new Map([[toolId, activator]]),
          new Map([[toolId, hostReader]])
        )
      );
      await expect(
        removeMarketplace.execute({
          name: alias,
          projectRoot: "/A",
          autoConfirm: true,
          scope: "user",
        })
      ).rejects.toThrow(/active projects/);

      const foreignUser = new InMemoryManifestRepository(Manifest.create());
      const foreignUseCase = new MarketplaceSyncSettingsUseCase(
        new InMemoryFileAdapter({
          [`${builtDir}/${catalogPath}`]: JSON.stringify({
            name: hostName,
            version: "1.0.0",
            plugins: [],
          }),
        }),
        foreign,
        registry,
        new DeterministicHasher(),
        new CapturingLogger(),
        new Map([[toolId, new FakeNativePluginActivator({ available: true })]]),
        fakeEnsureBuiltMarketplace(() => builtDir),
        new Map(),
        () => "/built",
        undefined,
        undefined,
        undefined,
        new Map([[toolId, hostReader]]),
        foreignUser
      );
      await foreignUseCase.execute({
        projectRoot: "/foreign",
        manifestRepo: foreign,
        toolIds: [toolId],
      });
      expect(foreign.getCurrent()?.getNativeRegistrations(toolId)?.pluginRefs).toEqual([]);
      expect(foreignUser.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims ?? []).toEqual(
        []
      );
      const removeFs = new InMemoryFileAdapter();
      const cacheRoot = nativeActivationOf(toolId)?.pluginCacheDir?.(resolveHomeDir());
      const cachedBytes =
        cacheRoot === undefined ? undefined : join(cacheRoot, hostName, "test-plugin", "skill.md");
      if (cachedBytes !== undefined)
        removeFs.setFile(cachedBytes, "B still uses this cached plugin");
      const remove = (repo: InMemoryManifestRepository) =>
        new PluginRemoveUseCase(
          removeFs,
          repo,
          new CapturingLogger(),
          new Map([[toolId, activator]]),
          new Map([[toolId, hostReader]]),
          undefined,
          registry,
          user
        );
      await remove(a).execute({ pluginName: "test-plugin", toolIds: [toolId], projectRoot: "/A" });
      expect(activator.uninstalledPlugins).toEqual([]);
      if (cachedBytes !== undefined)
        expect(removeFs.getFile(cachedBytes)).toBe("B still uses this cached plugin");
      expect(user.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref, dependents: ["/B"] },
      ]);
      await remove(b).execute({ pluginName: "test-plugin", toolIds: [toolId], projectRoot: "/B" });
      expect(activator.uninstalledPlugins).toEqual([]);
      expect(user.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref, dependents: [] },
      ]);
      await remove(a).execute({
        pluginName: "test-plugin",
        toolIds: [toolId],
        projectRoot: "/A",
        scope: "user",
      });
      expect(activator.uninstalledPlugins).toEqual([ref]);
      expect(user.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([]);
      enabled = false;
      await removeMarketplace.execute({
        name: alias,
        projectRoot: "/A",
        autoConfirm: true,
        scope: "user",
      });
      expect(activator.removedMarketplaces).toEqual([hostName]);
      expect((await registry.list("/A")).find((entry) => entry.name === alias)).toBeUndefined();
    });
  });
}
