// `claude`, `codex` and `copilot` only load a plugin once their own CLI has registered it, so
// removal must drive `uninstallPlugin` with the same `<plugin>@<marketplace>` ref install used.
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { describeCause } from "../../../../../src/presentation/errors/error-translator.presenter.js";
import { UnreadableUserSourceReferencesError } from "../../../../../src/shared/domain/shared.error.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import {
  FakeHostPluginRegistry,
  type FixedHostRegistry,
  type FixedRegistryReading,
} from "../../testing/fake-host-plugin-registry.fake.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";
import {
  installViaModeA,
  MARKETPLACE_NAME,
  PLUGIN_NAME,
  REF,
  verifiedSourceReader,
} from "../../testing/framework-plugin-on-claude.builder.js";
import {
  buildRemoveUseCase,
  NATIVE_PROJECT_ROOT as PROJECT_ROOT,
} from "../../testing/native-activation-removal.builder.js";
import { pluginRemover } from "../../testing/plugin-remover.builder.js";

const { claude } = TOOL;

describe("RemovePlugin undoes native activation", () => {
  it.each(["unrecorded activation", "absent catalogue"])(
    "refuses %s without changing project state",
    async (missing) => {
      const manifest = Manifest.create();
      manifest.addTool(claude, "test", []);
      await installViaModeA(manifest);
      if (missing === "unrecorded activation") {
        const registrations = manifest.getNativeRegistrations(claude);
        if (registrations === undefined) throw new Error("Expected native registration");
        manifest.setNativeRegistrations(claude, { ...registrations, pluginRefs: [] });
      }
      const before = manifest.toJSON();
      const activator = new FakeHostActions({ available: true });
      const repo = new InMemoryManifestRepository(manifest);
      const remove = pluginRemover({
        manifestRepo: repo,
        activators: new Map([[claude, activator]]),
        nativeMarketplaceSources: new Map([
          [claude, { read: async () => ({ location: "/host/catalogue", entries: new Map() }) }],
        ]),
      });
      await expect(
        remove.execute({
          pluginName: PLUGIN_NAME,
          toolIds: [claude],
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(
        missing === "unrecorded activation"
          ? `claude: '${REF}' is not a ref this project enabled; reconcile manually before removal.`
          : `claude: catalogue '${MARKETPLACE_NAME}' has unproven host source; reconcile manually.`
      );
      expect(manifest.toJSON()).toEqual(before);
      expect(repo.saveCount).toBe(0);
      expect(activator.uninstalledPlugins).toEqual([]);
    }
  );

  it.each([
    { name: MARKETPLACE_NAME, scope: "user" as const, readsLedger: true },
    { name: MARKETPLACE_NAME, scope: "project" as const, readsLedger: false },
    { name: "unrelated", scope: "user" as const, readsLedger: false },
  ])(
    "checks the shared-source ledger only for $name/$scope without blocking project-scoped uninstall",
    async ({ name, scope, readsLedger }) => {
      const manifest = Manifest.create();
      manifest.addTool(claude, "test", []);
      await installViaModeA(manifest);
      const repo = new InMemoryManifestRepository(manifest);
      const activator = new FakeHostActions({ available: true });
      const logger = new CapturingLogger();
      const registry = new FakeMarketplaceRegistry();
      registry.seed(PROJECT_ROOT, {
        name,
        scope,
        source: { kind: "local", path: "/plugin-source" },
      });
      const ledgerError = new UnreadableUserSourceReferencesError(
        "/references.json",
        "invalid JSON"
      );
      const list = vi.fn(async (): Promise<readonly string[]> => {
        throw ledgerError;
      });
      const remove = pluginRemover({
        manifestRepo: repo,
        logger,
        activators: new Map([[claude, activator]]),
        hostPluginRegistries: new Map([
          [
            claude,
            new FakeHostPluginRegistry({
              location: "/host/registry",
              refs: new Map([[REF, { enabled: true, scope: "project" }]]),
            }),
          ],
        ]),
        userSourceReferences: {
          addReference: async () => {},
          removeReference: async () => {},
          listAllReferencingProjects: list,
        },
        marketplaceRegistry: registry,
        nativeMarketplaceSources: new Map([[claude, verifiedSourceReader()]]),
      });

      await remove.execute({
        pluginName: PLUGIN_NAME,
        toolIds: [claude],
        projectRoot: PROJECT_ROOT,
      });

      expect(list).toHaveBeenCalledTimes(readsLedger ? 1 : 0);
      expect(logger.warnMessages).toEqual(readsLedger ? [describeCause(ledgerError)] : []);
      expect(activator.uninstalledPlugins).toEqual([REF]);
      expect(activator.uninstalledPluginScopes).toEqual(["project"]);
      expect(manifest.getNativeRegistrations(claude)?.pluginRefs).toEqual([]);
    }
  );

  describe("host registry preflight preserves project state", () => {
    const invalidReadings: {
      name: string;
      reading: FixedRegistryReading;
      diagnostic: string;
    }[] = [
      {
        name: "missing registry",
        reading: { location: "/host/registry", absent: true },
        diagnostic: "/host/registry",
      },
      {
        name: "unreadable registry",
        reading: { location: "/host/registry", unreadable: "permission denied" },
        diagnostic: "permission denied",
      },
      {
        name: "empty registry",
        reading: { location: "/host/registry", refs: new Map() },
        diagnostic: "/host/registry",
      },
      {
        name: "disabled activation",
        reading: {
          location: "/host/registry",
          refs: new Map([[REF, { enabled: false, scope: "project" }]]),
        },
        diagnostic: "/host/registry",
      },
      {
        name: "unscoped activation",
        reading: { location: "/host/registry", refs: new Map([[REF, { enabled: true }]]) },
        diagnostic: "/host/registry",
      },
    ];
    const registryFailures: { name: string; reader?: FixedHostRegistry; message: string }[] = [
      {
        name: "no reader",
        message: `claude: '${REF}' has no readable host plugin registry; uninstall refused before project changes.`,
      },
      ...invalidReadings.map(({ name, reading, diagnostic }) => ({
        name,
        reader: new FakeHostPluginRegistry(reading),
        message: `claude: '${REF}' is not provably enabled with an exact host scope (${diagnostic}); uninstall refused.`,
      })),
    ];

    it.each(registryFailures)(
      "refuses $name before native or local changes",
      async ({ reader, message }) => {
        const fs = new InMemoryFileAdapter();
        const manifest = Manifest.create();
        manifest.addTool(claude, "test", []);
        await installViaModeA(manifest);
        const manifestRepo = new InMemoryManifestRepository(manifest);
        const before = manifest.toJSON();
        const cacheFile = join(
          homedir(),
          ".claude/plugins/cache",
          MARKETPLACE_NAME,
          PLUGIN_NAME,
          "1.0.0/plugin.json"
        );
        await fs.writeFile(cacheFile, "cached plugin");
        const activator = new FakeHostActions({ available: true });
        const remove = pluginRemover({
          fs,
          manifestRepo,
          activators: new Map([[claude, activator]]),
          hostPluginRegistries: reader === undefined ? new Map() : new Map([[claude, reader]]),
          nativeMarketplaceSources: new Map([[claude, verifiedSourceReader()]]),
        });

        await expect(
          remove.execute({
            pluginName: PLUGIN_NAME,
            toolIds: [claude],
            projectRoot: PROJECT_ROOT,
          })
        ).rejects.toThrow(message);

        expect(activator.uninstalledPlugins).toEqual([]);
        expect(manifestRepo.saveCount).toBe(0);
        expect(manifest.toJSON()).toEqual(before);
        expect(await fs.readFile(cacheFile)).toBe("cached plugin");
      }
    );
  });
});

describe("RemovePlugin undoes only the activation this project made", () => {
  async function removeWithRecordedRefs(pluginRefs: readonly string[]) {
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool(claude, "test", []);
    await installViaModeA(manifest);
    manifest.setNativeRegistrations(claude, {
      binary: "claude",
      marketplaces: [
        {
          alias: MARKETPLACE_NAME,
          hostName: MARKETPLACE_NAME,
          provenance: { kind: "registry", source: "/plugin-source" },
        },
      ],
      pluginRefs,
    });
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [claude],
      projectRoot: PROJECT_ROOT,
    });
    return { activator, logger, manifestRepo };
  }

  it("uninstalls a ref this project's own activation enabled", async () => {
    const { activator } = await removeWithRecordedRefs([REF]);

    expect(activator.uninstalledPlugins).toEqual([REF]);
  });
});
