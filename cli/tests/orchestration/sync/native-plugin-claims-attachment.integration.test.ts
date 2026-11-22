import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../src/composition/installation.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { PluginDistributionReaderAdapter } from "../../../src/contexts/distribution/infrastructure/plugin-distribution-reader-adapter.js";
import { NativeHostRegistrationGate } from "../../../src/contexts/host-registration/application/native-host-registration-gate.js";
import { RefreshHostPlugin } from "../../../src/contexts/host-registration/application/refresh-host-plugin.use-case.js";
import type { HostPluginRegistry } from "../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import { PluginMaterializer } from "../../../src/contexts/installation/application/plugin/plugin-materializer.js";
import { UpdateUserPluginFiles } from "../../../src/contexts/installation/application/plugin/update-user-plugin-files.use-case.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { isStrictlyWithinUserScope } from "../../../src/contexts/machine-claims/domain/user-scope-containment.js";
import { UpdateUserPlugin } from "../../../src/orchestration/plugin/update-user-plugin.use-case.js";
import { resolveHomeDir } from "../../../src/shared/infrastructure/home-dir.js";
import { fakeBuiltDeps } from "../../contexts/installation/testing/fake-build-sources.fake.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import {
  pluginRemover,
  userPluginRemover,
} from "../../contexts/installation/testing/plugin-remover.builder.js";
import { userScopeFileGuard } from "../../contexts/installation/testing/user-scope-file-guard.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { FixturePluginFetcher } from "../../shared/testing/fixture-plugin-fetcher.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { loadDistributionOf } from "../../shared/testing/load-distribution.builder.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import { registeredManifestProbes } from "../../shared/testing/registered-manifest-probes.builder.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import { saying } from "../../shared/testing/saying.builder.js";
import { effectiveListSources } from "../testing/effective-list-sources.builder.js";
import { userMarketplaceRemover } from "../testing/user-marketplace-remover.builder.js";

for (const [toolId, catalogPath] of [
  [TOOL.codex, ".agents/plugins/marketplace.json"],
  [TOOL.copilot, ".plugin/marketplace.json"],
] as const) {
  describe(`${toolId} machine plugin claims`, () => {
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
      const project = () => {
        const manifest = aManifest()
          .withTool(toolId, [])
          .withPlugin(
            toolId,
            InstalledPlugin.fromMetadata({
              name: "test-plugin",
              version: "1.0.0",
              source: { kind: "local", path: "/src" },
              strict: false,
              scope: "project",
              marketplace: alias,
            })
          )
          .build();
        return new InMemoryManifestRepository(manifest);
      };
      const a = project();
      const b = project();
      const foreign = project();
      const machine = Manifest.create();
      machine.addTool(toolId, "1.0.0", []);
      machine.setNativeRegistrations(toolId, {
        binary: toolId,
        marketplaces: [
          {
            alias,
            hostName,
            provenance: {
              kind: "effective-list",
              root: builtDir,
              sourceType: "local",
              source: builtDir,
            },
          },
        ],
        pluginRefs: [],
        pluginClaims: [],
      });
      const user = new InMemoryManifestRepository(machine);
      const activator = new FakeHostActions({ available: true });
      const sources = effectiveListSources(toolId, hostName, builtDir);
      let enabled = false;
      const hostReader: HostPluginRegistry = {
        read: async () => ({
          location: "/host/registry",
          refs: new Map(enabled ? [[ref, { enabled: true, scope: "user" as const }]] : []),
        }),
      };
      const syncOf = (manifestRepo: InMemoryManifestRepository) =>
        marketplaceSync({
          fs: new InMemoryFileAdapter(
            {
              [`${builtDir}/${catalogPath}`]: JSON.stringify({
                name: hostName,
                version: "1.0.0",
                plugins: [],
              }),
            },
            ["/A", "/B"]
          ),
          manifestRepo,
          marketplaceRegistry: registry,
          logger: new CapturingLogger(),
          activators: new Map([[toolId, activator]]),
          ensureBuilt: fakeEnsureBuiltMarketplace(() => builtDir),
          userCacheRoot: () => "/built",
          hostPluginRegistries: new Map([[toolId, hostReader]]),
          userManifestRepo: user,
          nativeSources: sources,
        });
      await syncOf(a).execute({
        projectRoot: "/A",
        toolIds: [toolId],
      });
      enabled = true;
      await syncOf(b).execute({
        projectRoot: "/B",
        toolIds: [toolId],
      });
      expect(activator.enabledPlugins).toEqual([ref]);
      expect(b.getCurrent()?.getNativeRegistrations(toolId)?.pluginRefs).toContain(ref);
      expect(user.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref, dependents: ["/A", "/B"] },
      ]);
      const updateFs = new InMemoryFileAdapter({}, ["/A", "/B"]);
      const update = new UpdateUserPlugin(
        new UpdateUserPluginFiles(
          {
            repo: user,
            materializer: new PluginMaterializer({
              fs: updateFs,
              loadDistribution: loadDistributionOf(
                new FixturePluginFetcher(),
                new PluginDistributionReaderAdapter(updateFs, registeredManifestProbes())
              ),
              guard: userScopeFileGuard,
              builtDeps: fakeBuiltDeps(),
            }),
            logger: new CapturingLogger(),
            records: registrationRecordRules,
          },
          registeredTools()
        ),
        new RefreshHostPlugin(
          new Map([[toolId, activator]]),
          new Map([[toolId, hostReader]]),
          sources
        ),
        isStrictlyWithinUserScope
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
        const failed = new FakeHostActions({ available: true, failOnUpdate: [ref] });
        const failingUpdate = new UpdateUserPlugin(
          new UpdateUserPluginFiles(
            {
              repo: user,
              materializer: new PluginMaterializer({
                fs: updateFs,
                loadDistribution: loadDistributionOf(
                  new FixturePluginFetcher(),
                  new PluginDistributionReaderAdapter(updateFs, registeredManifestProbes())
                ),
                guard: userScopeFileGuard,
                builtDeps: fakeBuiltDeps(),
              }),
              logger: new CapturingLogger(),
              records: registrationRecordRules,
            },
            registeredTools()
          ),
          new RefreshHostPlugin(
            new Map([[toolId, failed]]),
            new Map([[toolId, hostReader]]),
            sources
          ),
          isStrictlyWithinUserScope
        );
        await expect(
          failingUpdate.execute({
            pluginNames: ["test-plugin"],
            toolIds: [toolId],
            projectRoot: "/A",
            scope: "user",
          })
        ).rejects.toThrow(
          expect.objectContaining({ detail: expect.stringMatching(/plugin update.*failed/) })
        );
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
      const removeMarketplace = userMarketplaceRemover(
        new InMemoryFileAdapter({}, ["/A", "/B"]),
        user,
        registry,
        new NativeHostRegistrationGate(
          new Map([[toolId, activator]]),
          new Map([[toolId, hostReader]]),
          sources
        )
      );
      await expect(
        removeMarketplace.execute({
          name: alias,
          projectRoot: "/A",
          autoConfirm: true,
          scope: "user",
        })
      ).rejects.toThrow(saying(/active projects/));

      const foreignUser = new InMemoryManifestRepository(Manifest.create());
      const foreignUseCase = marketplaceSync({
        fs: new InMemoryFileAdapter(
          {
            [`${builtDir}/${catalogPath}`]: JSON.stringify({
              name: hostName,
              version: "1.0.0",
              plugins: [],
            }),
          },
          ["/A", "/B", "/foreign"]
        ),
        manifestRepo: foreign,
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[toolId, new FakeHostActions({ available: true })]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => builtDir),
        userCacheRoot: () => "/built",
        hostPluginRegistries: new Map([[toolId, hostReader]]),
        userManifestRepo: foreignUser,
        nativeSources: sources,
      });
      await foreignUseCase.execute({
        projectRoot: "/foreign",
        toolIds: [toolId],
      });
      expect(foreign.getCurrent()?.getNativeRegistrations(toolId)?.pluginRefs).toEqual([]);
      expect(foreignUser.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims ?? []).toEqual(
        []
      );
      const removeFs = new InMemoryFileAdapter({}, ["/A", "/B"]);
      const cacheRoot = registeredTools()
        .aiProfile(toolId)
        .nativeActivation()
        ?.pluginCacheRoot(resolveHomeDir());
      const cachedBytes =
        cacheRoot === undefined ? undefined : join(cacheRoot, hostName, "test-plugin", "skill.md");
      if (cachedBytes !== undefined)
        removeFs.setFile(cachedBytes, "B still uses this cached plugin");
      const removing = (repo: InMemoryManifestRepository) => ({
        fs: removeFs,
        manifestRepo: repo,
        activators: new Map([[toolId, activator]]),
        hostPluginRegistries: new Map([[toolId, hostReader]]),
        marketplaceRegistry: registry,
        userManifestRepo: user,
        nativeMarketplaceSources: sources,
      });
      const remove = (repo: InMemoryManifestRepository) => pluginRemover(removing(repo));
      await remove(a).execute({
        pluginName: "test-plugin",
        toolIds: [toolId],
        projectRoot: "/A",
      });
      expect(activator.uninstalledPlugins).toEqual([]);
      if (cachedBytes !== undefined)
        expect(removeFs.getFile(cachedBytes)).toBe("B still uses this cached plugin");
      expect(user.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref, dependents: ["/B"] },
      ]);
      await remove(b).execute({
        pluginName: "test-plugin",
        toolIds: [toolId],
        projectRoot: "/B",
      });
      expect(activator.uninstalledPlugins).toEqual([]);
      expect(user.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref, dependents: [] },
      ]);
      await userPluginRemover(removing(a)).execute({
        pluginName: "test-plugin",
        toolIds: [toolId],
        projectRoot: "/A",
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
