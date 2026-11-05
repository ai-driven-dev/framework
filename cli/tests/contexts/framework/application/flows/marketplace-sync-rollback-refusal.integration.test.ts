import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FRAMEWORK_MARKETPLACE_NAME,
  Marketplace,
} from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { MarketplaceSyncSettingsUseCase } from "../../../../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { resolvePluginsCapability } from "../../../../../src/contexts/tools/domain/registry.js";
import { BUILT_CACHE_SUBDIR, userBuiltMarketplaceDir } from "../../../../../src/kernel/paths.js";
import type { MarketplaceScope } from "../../../../../src/kernel/scope.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { FakeHostMarketplaceRegistryReader } from "../../../../helpers/ports/fake-host-marketplace-registry-reader.js";
import { FakeHostPluginRegistryReader } from "../../../../helpers/ports/fake-host-plugin-registry-reader.js";
import { FakeNativeMarketplaceSourceReader } from "../../../../helpers/ports/fake-native-marketplace-source-reader.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

const PROJECT_ROOT = "/test-project";
const REGISTRY_LOCATION = "/home/.claude/plugins/known_marketplaces.json";
const USER_CACHE_ROOT = "/user-cache";
const MARKETPLACE_NAME = "probe-mkt";

function sharedPath(version: string, name: string = MARKETPLACE_NAME): string {
  return userBuiltMarketplaceDir(USER_CACHE_ROOT, version, name, "claude");
}

async function sync(options: {
  requestedVersion: string;
  registeredPath?: string;
  registeredVersion?: string;
  scope?: MarketplaceScope;
  name?: string;
  recreateFrameworkIfMissing?: boolean;
  staleCacheFile?: string;
  testPlugin?: boolean;
  refreshOwnedPlugins?: boolean;
}) {
  const name = options.name ?? MARKETPLACE_NAME;
  const fs = new InMemoryFileAdapter();
  const manifestRepo = new InMemoryManifestRepository();
  const registry = new InMemoryMarketplaceRegistry();
  const logger = new CapturingLogger();
  const manifest = Manifest.create();
  manifest.addTool("claude", "test", []);
  if (options.testPlugin)
    manifest.addPlugin(
      "claude",
      InstalledPlugin.fromMetadata(
        "test-plugin",
        "1.0.0",
        { kind: "local", path: "/source" },
        true,
        "project",
        name
      )
    );
  if (options.testPlugin && options.registeredPath)
    manifest.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [
        {
          alias: name,
          hostName: name,
          provenance: { kind: "registry", source: options.registeredPath },
        },
      ],
      pluginRefs: [`test-plugin@${name}`],
    });
  const machine = Manifest.create();
  machine.addTool("claude", "test", []);
  machine.setNativeRegistrations("claude", {
    binary: "claude",
    marketplaces: [
      {
        alias: name,
        hostName: name,
        ...(options.registeredPath === undefined
          ? {}
          : { provenance: { kind: "registry" as const, source: options.registeredPath } }),
      },
    ],
    pluginRefs: [],
    pluginClaims: options.testPlugin
      ? [{ ref: `test-plugin@${name}`, dependents: [PROJECT_ROOT, "/other-project"] }]
      : [],
  });
  await manifestRepo.save(manifest);
  await registry.save(
    PROJECT_ROOT,
    Marketplace.create({
      name,
      source: { kind: "local", path: "/source" },
      scope: options.scope ?? "user",
      addedAt: "2026-01-01T00:00:00Z",
    })
  );
  const builtDir = sharedPath(options.requestedVersion, name);
  await fs.writeFile(
    `${builtDir}/.claude-plugin/marketplace.json`,
    JSON.stringify({ name, version: options.requestedVersion, plugins: [] })
  );
  if (options.registeredPath !== undefined) {
    await fs.writeFile(
      `${options.registeredPath}/.claude-plugin/marketplace.json`,
      JSON.stringify({ name, version: options.registeredVersion, plugins: [] })
    );
  }
  if (options.staleCacheFile !== undefined) await fs.writeFile(options.staleCacheFile, "stale");
  const activator = new FakeNativePluginActivator({
    available: true,
    enablesPlugins: options.testPlugin === true,
  });
  const hostReader = new FakeHostMarketplaceRegistryReader({
    location: REGISTRY_LOCATION,
    entries:
      options.registeredPath === undefined ? new Map() : new Map([[name, options.registeredPath]]),
  });
  const machineRepo = new InMemoryManifestRepository(machine);
  const sourceReferences: string[] = [];
  const useCase = new MarketplaceSyncSettingsUseCase(
    fs,
    manifestRepo,
    registry,
    new DeterministicHasher(),
    logger,
    new Map([["claude", activator]]),
    fakeEnsureBuiltMarketplace(() => builtDir),
    new Map([["claude", hostReader]]),
    () => USER_CACHE_ROOT,
    undefined,
    options.testPlugin
      ? {
          addReference: async (_version, root) => {
            sourceReferences.push(root);
          },
          removeReference: async () => {},
          listAllReferencingProjects: async () => [],
        }
      : undefined,
    options.testPlugin ? { get: () => options.requestedVersion } : undefined,
    new Map([
      [
        "claude",
        new FakeHostPluginRegistryReader({
          location: "/home/.claude/plugins/installed_plugins.json",
          refs: options.testPlugin
            ? new Map([[`test-plugin@${name}`, { enabled: true }]])
            : new Map(),
        }),
      ],
    ]),
    machineRepo,
    new Map([
      [
        "claude",
        new FakeNativeMarketplaceSourceReader(
          activator,
          "registry",
          (path) => (path === builtDir ? name : undefined),
          options.registeredPath === undefined
            ? new Map()
            : new Map([[name, { kind: "registry", source: options.registeredPath }]])
        ),
      ],
    ])
  );
  const result = await useCase.execute({
    projectRoot: PROJECT_ROOT,
    recreateFrameworkIfMissing: options.recreateFrameworkIfMissing,
    ...(options.refreshOwnedPlugins
      ? { refreshOwnedPlugins: [{ toolId: "claude", pluginName: "test-plugin" }] }
      : {}),
  });
  return { result, activator, logger, manifestRepo, machineRepo, sourceReferences, fs };
}

describe("the sync write path refuses to roll a host back to an older aidd-framework build", () => {
  it("does not touch a shared native plugin when another project uses a newer build", async () => {
    const activation = resolvePluginsCapability("claude")?.nativeActivation;
    if (!activation) throw new Error("missing native activation");
    activation.refreshOwnedOnReleaseUpdate = true;
    try {
      const { result, activator, manifestRepo, machineRepo, sourceReferences } = await sync({
        requestedVersion: "1.0.0",
        registeredPath: sharedPath("2.0.0", FRAMEWORK_MARKETPLACE_NAME),
        registeredVersion: "2.0.0",
        name: FRAMEWORK_MARKETPLACE_NAME,
        testPlugin: true,
        refreshOwnedPlugins: true,
      });
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(activator.addedMarketplaces).toEqual([]);
      expect(activator.enabledPlugins).toEqual([]);
      expect(activator.upgradeCount).toBe(0);
      expect(manifestRepo.getCurrent()?.getNativeRegistrations("claude")?.pluginRefs).toEqual([
        `test-plugin@${FRAMEWORK_MARKETPLACE_NAME}`,
      ]);
      expect(machineRepo.getCurrent()?.getNativeRegistrations("claude")?.pluginClaims).toEqual([
        {
          ref: `test-plugin@${FRAMEWORK_MARKETPLACE_NAME}`,
          dependents: [PROJECT_ROOT, "/other-project"],
        },
      ]);
      expect(machineRepo.saveCount).toBe(0);
      expect(sourceReferences).toEqual([]);
    } finally {
      delete activation.refreshOwnedOnReleaseUpdate;
    }
  });
  // The host already follows a newer build of the shared source than this run would request, so
  // writing anyway would silently repoint it backward.
  it("writes nothing and warns naming both versions and `aidd update`, when the host already follows a newer shared build", async () => {
    const { result, activator, logger } = await sync({
      requestedVersion: "1.0.0",
      registeredPath: sharedPath("2.0.0"),
      registeredVersion: "2.0.0",
    });

    expect(activator.addedMarketplaces).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(
      logger.warnMessages.some(
        (m) => m.includes("2.0.0") && m.includes("1.0.0") && m.includes("aidd update")
      )
    ).toBe(true);
    expect(result.warnings.some((m) => m.includes("aidd update"))).toBe(true);
  });

  // The migration itself: the host still points at this project's own pre-migration
  // cache, and this run's build is the newer, shared source — it must proceed.
  it("proceeds when the host still points at this project's own pre-migration cache", async () => {
    const { result, activator } = await sync({
      requestedVersion: "1.0.0",
      registeredPath: `${PROJECT_ROOT}/.aidd/cache/built/${MARKETPLACE_NAME}/claude`,
    });

    expect(activator.addedMarketplaces).toEqual([sharedPath("1.0.0")]);
    expect(result.errors).toEqual([]);
  });

  it("proceeds when the host already follows an older shared build — a legitimate update, not a rollback", async () => {
    const { result, activator } = await sync({
      requestedVersion: "2.0.0",
      registeredPath: sharedPath("1.0.0"),
      registeredVersion: "1.0.0",
    });

    expect(activator.addedMarketplaces).toEqual([sharedPath("2.0.0")]);
    expect(result.errors).toEqual([]);
  });

  it("does nothing extra when the host already follows this exact shared version", async () => {
    const { result, activator } = await sync({
      requestedVersion: "1.0.0",
      registeredPath: sharedPath("1.0.0"),
      registeredVersion: "1.0.0",
    });

    expect(activator.addedMarketplaces).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("warns with the whole message: the registry, both versions and the command that fixes it", async () => {
    const { result, logger } = await sync({
      requestedVersion: "1.0.0",
      registeredPath: sharedPath("2.0.0"),
      registeredVersion: "2.0.0",
    });

    const refusal =
      "claude's marketplace registry (/home/.claude/plugins/known_marketplaces.json) already carries a newer aidd-framework build, 2.0.0, than this run's own 1.0.0 — not registering this run's build over it. Run `aidd update` to bring this project's CLI to at least the version the host already follows.";
    expect(result.warnings).toStrictEqual([refusal]);
    expect(logger.warnMessages).toStrictEqual([refusal]);
  });

  it("does not claim the newer host marketplace when the project did not own it", async () => {
    const { manifestRepo } = await sync({
      requestedVersion: "1.0.0",
      registeredPath: sharedPath("2.0.0"),
      registeredVersion: "2.0.0",
    });

    expect((await manifestRepo.load())?.getNativeRegistrations("claude")).toStrictEqual({
      binary: "claude",
      marketplaces: [],
      pluginRefs: [],
    });
  });

  it("still purges this project's own pre-migration cache after a refused rollback: the host is on a build, not on that cache", async () => {
    const staleCacheFile = join(
      PROJECT_ROOT,
      BUILT_CACHE_SUBDIR,
      FRAMEWORK_MARKETPLACE_NAME,
      "claude",
      "agents",
      "some-agent.md"
    );
    const { result, fs } = await sync({
      name: FRAMEWORK_MARKETPLACE_NAME,
      requestedVersion: "1.0.0",
      registeredPath: sharedPath("2.0.0", FRAMEWORK_MARKETPLACE_NAME),
      registeredVersion: "2.0.0",
      recreateFrameworkIfMissing: true,
      staleCacheFile,
    });

    expect(result.warnings).toHaveLength(1);
    expect(result.errors).toStrictEqual([]);
    expect(fs.has(staleCacheFile)).toBe(false);
  });
});
