import { describe, expect, it } from "vitest";
import { describeMessage } from "../../../src/presentation/errors/describe-message.presenter.js";
import {
  builtMarketplaceDir,
  userBuiltMarketplaceDir,
} from "../../../src/shared/domain/layout/aidd-layout.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import {
  SYNTHETIC_TOOL,
  syntheticNativeCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";
import {
  hostReadingOf,
  MARKETPLACE,
  marketplace,
  nativeActivationOf,
  PROJECT_ROOT,
  REF,
} from "../testing/marketplace-sync-native-activation.builder.js";

const tool = SYNTHETIC_TOOL;
const { buildSyncReadingHost, manifestWithPlugin, nativeSource, ownedMachineCatalog } =
  nativeActivationOf({ tools: syntheticNativeCatalog(tool), tool });

describe("native activation: reclaim", () => {
  describe("reclaiming a dead registration asks and acts on the host's own name", () => {
    it("checks and removes the catalog's own name, not this project's local alias, before re-adding", async () => {
      const CATALOG_NAME = "aidd-framework-catalog";
      const activator = new FakeHostActions({
        available: true,
        conflictOnAdd: true,
        registrationState: "dead",
      });
      const registry = new InMemoryMarketplaceRegistry();
      const fs = new InMemoryFileAdapter({
        [`/built/${tool}/.plugin/marketplace.json`]: JSON.stringify({
          name: CATALOG_NAME,
          version: "1.0.0",
          plugins: [],
        }),
      });
      const manifestRepo = manifestWithPlugin();
      const useCase = marketplaceSync({
        tools: syntheticNativeCatalog(tool),
        fs,
        manifestRepo,
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[tool, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(),
        hostMarketplaceRegistries: new Map([
          [
            tool,
            {
              read: async () => ({
                location: `/home/.${tool}/known_marketplaces.json`,
                entries: new Map([
                  [CATALOG_NAME, builtMarketplaceDir(PROJECT_ROOT, MARKETPLACE, tool)],
                ]),
              }),
            },
          ],
        ]),
        hostPluginRegistries: new Map([[tool, { read: async () => hostReadingOf([]) }]]),
        userManifestRepo: ownedMachineCatalog(
          CATALOG_NAME,
          builtMarketplaceDir(PROJECT_ROOT, MARKETPLACE, tool)
        ),
        nativeSources: nativeSource(
          activator,
          CATALOG_NAME,
          new Map([
            [
              CATALOG_NAME,
              {
                kind: "registry",
                source: builtMarketplaceDir(PROJECT_ROOT, MARKETPLACE, tool),
              },
            ],
          ])
        ),
      });
      await registry.save(PROJECT_ROOT, marketplace());

      await useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(activator.removedMarketplaces).toEqual([CATALOG_NAME]);
      expect(activator.removedMarketplaces).not.toContain(MARKETPLACE);
      // The reclaim's second `addMarketplace` succeeded once `removedMarketplaces` was
      // non-empty (the fake's own `conflictOnAdd` bypass), so activation still finished.
      expect(activator.addedMarketplaces).not.toEqual([]);
    });
  });

  describe("what reclaiming a dead registration says", () => {
    const CATALOG_NAME = "aidd-framework-catalog";
    const RECLAIM =
      "Marketplace 'aidd-framework-catalog' was registered to a directory that no longer exists; re-registering it for this project. Plugins installed from it are removed and the ones this CLI manages are put back.";

    function reclaimSync(
      activator: FakeHostActions,
      hostSource = builtMarketplaceDir(PROJECT_ROOT, MARKETPLACE, tool),
      userRoot = ""
    ) {
      const registry = new InMemoryMarketplaceRegistry();
      class UserRootThatCannotResolve extends InMemoryFileAdapter {
        override async realpath(path: string): Promise<string> {
          if (userRoot !== "" && path === userRoot) throw new Error("ENOENT: user cache is absent");
          return super.realpath(path);
        }
      }
      const fs = new UserRootThatCannotResolve({
        [`/built/${tool}/.plugin/marketplace.json`]: JSON.stringify({
          name: CATALOG_NAME,
          version: "1.0.0",
          plugins: [],
        }),
        "/foreign/cache/marker": "foreign bytes",
      });
      const logger = new CapturingLogger();
      const useCase = marketplaceSync({
        tools: syntheticNativeCatalog(tool),
        fs,
        manifestRepo: manifestWithPlugin(),
        marketplaceRegistry: registry,
        logger,
        activators: new Map([[tool, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(),
        hostMarketplaceRegistries: new Map([
          [
            tool,
            {
              read: async () => ({
                location: `/home/.${tool}/known_marketplaces.json`,
                entries: new Map([[CATALOG_NAME, hostSource]]),
              }),
            },
          ],
        ]),
        userCacheRoot: () => userRoot,
        hostPluginRegistries: new Map([[tool, { read: async () => hostReadingOf([]) }]]),
        userManifestRepo: ownedMachineCatalog(
          CATALOG_NAME,
          hostSource === "/foreign/cache"
            ? builtMarketplaceDir(PROJECT_ROOT, MARKETPLACE, tool)
            : hostSource
        ),
        nativeSources: nativeSource(
          activator,
          CATALOG_NAME,
          new Map([[CATALOG_NAME, { kind: "registry", source: hostSource }]])
        ),
      });
      return { useCase, registry, logger, fs };
    }

    it("leaves a foreign host source and its cache untouched even with a past AIDD claim", async () => {
      const activator = new FakeHostActions({
        available: true,
        conflictOnAdd: true,
        registrationState: "dead",
      });
      const { useCase, registry, fs } = reclaimSync(activator, "/foreign/cache");
      await registry.save(PROJECT_ROOT, marketplace());

      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(result.warnings.join("\n")).toContain(
        "current host source differs from AIDD's recorded source"
      );
      expect(activator.removedMarketplaces).toEqual([]);
      expect(activator.forcedRemovals).toEqual([]);
      expect(activator.addedMarketplaces).toEqual([]);
      expect(await fs.readFile("/foreign/cache/marker")).toBe("foreign bytes");
    });

    it("does not force-remove a live registration even when its source is proven", async () => {
      const activator = new FakeHostActions({
        available: true,
        conflictOnAdd: true,
        registrationState: "live",
      });
      const { useCase, registry } = reclaimSync(activator);
      await registry.save(PROJECT_ROOT, marketplace());

      await useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(activator.removedMarketplaces).toEqual([]);
      expect(activator.forcedRemovals).toEqual([]);
      expect(activator.addedMarketplaces).toEqual([]);
    });

    it("reclaims a dead registration from an exact AIDD shared user-cache source", async () => {
      const activator = new FakeHostActions({
        available: true,
        conflictOnAdd: true,
        registrationState: "dead",
      });
      const userRoot = "/home/aidd";
      const source = userBuiltMarketplaceDir({
        userConfigDir: userRoot,
        cliVersion: "1.0.0",
        marketplaceName: MARKETPLACE,
        target: tool,
      });
      const { useCase, registry } = reclaimSync(activator, source, userRoot);
      await registry.save(PROJECT_ROOT, marketplace());

      await useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(activator.removedMarketplaces).toEqual([CATALOG_NAME]);
      expect(activator.forcedRemovals).toEqual([true]);
      expect(activator.addedMarketplaces).toEqual([`/built/${tool}`]);
    });

    it("names the vanished directory's own registration in the one warning it gives", async () => {
      const activator = new FakeHostActions({
        available: true,
        conflictOnAdd: true,
        registrationState: "dead",
      });
      const { useCase, registry, logger } = reclaimSync(activator);
      await registry.save(PROJECT_ROOT, marketplace());

      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(result.warnings).toStrictEqual([RECLAIM]);
      expect(logger.warnMessages).toStrictEqual([RECLAIM]);
    });

    it("warns for each reclaim step the host's CLI refused, naming the step and the reason", async () => {
      const activator = new FakeHostActions({
        available: true,
        conflictOnAdd: true,
        throwOnRemove: true,
        registrationState: "dead",
      });
      const { useCase, registry } = reclaimSync(activator);
      await registry.save(PROJECT_ROOT, marketplace());

      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(result.warnings).toStrictEqual([
        RECLAIM,
        "Native plugin activation — unregister stale marketplace 'aidd-framework-catalog' skipped: marketplace remove aidd-framework-catalog failed: 'aidd-framework-catalog' is not configured or installed",
      ]);
      expect(activator.addedMarketplaces).toEqual([]);
      expect(result.errors).toStrictEqual([]);
    });
  });

  describe("a ref the host had enabled before this project asked belongs to the person", () => {
    it("is neither enabled again nor recorded, so clean has nothing of it to undo", async () => {
      const activator = new FakeHostActions({ available: true });
      const { useCase, registry, manifestRepo, logger } = buildSyncReadingHost(activator, {
        read: async () => hostReadingOf([REF]),
      });
      await registry.save(PROJECT_ROOT, marketplace());

      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(activator.enabledPlugins).toEqual([]);
      expect(activator.addedMarketplaces).toEqual([]);
      expect(result.warnings.join("\n")).toContain(`foreign host ref '${REF}'`);
      expect(logger.warnMessages).toEqual(result.warnings);
      const recorded = (await manifestRepo.load())?.getNativeRegistrations(tool);
      expect(recorded?.pluginRefs).toEqual([]);
    });

    it("stays this project's own on the next sync, once the host reports the enable it made", async () => {
      const activator = new FakeHostActions({ available: true });
      const { useCase, registry, manifestRepo } = buildSyncReadingHost(
        activator,
        {
          read: async () => hostReadingOf(activator.enabledPlugins),
        },
        true
      );
      await registry.save(PROJECT_ROOT, marketplace());

      await useCase.execute({ projectRoot: PROJECT_ROOT });
      await useCase.execute({ projectRoot: PROJECT_ROOT });

      const recorded = (await manifestRepo.load())?.getNativeRegistrations(tool);
      expect(recorded?.pluginRefs).toEqual([REF]);
    });

    it.each([
      [
        "cannot be read",
        { location: "/home/dev/.host/plugins/installed_plugins.json", unreadable: "ENOENT" },
      ],
      ["lists it disabled", hostReadingOf([REF], false)],
    ])("refuses to claim a ref when the host registry %s", async (_case, reading) => {
      const activator = new FakeHostActions({ available: true });
      const { useCase, registry, manifestRepo } = buildSyncReadingHost(activator, {
        read: async () => reading,
      });
      await registry.save(PROJECT_ROOT, marketplace());

      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(activator.enabledPlugins).toEqual([]);
      expect(activator.addedMarketplaces).toEqual([]);
      expect(
        result.warnings.some((warning) =>
          describeMessage(warning).includes("registration left untouched")
        )
      ).toBe(true);
      const recorded = (await manifestRepo.load())?.getNativeRegistrations(tool);
      expect(recorded?.pluginRefs).toEqual([]);
    });
  });
});
