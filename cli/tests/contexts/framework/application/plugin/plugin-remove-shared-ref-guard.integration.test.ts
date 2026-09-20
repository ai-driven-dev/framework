/** At a host that enables a plugin machine-wide (no `NativeActivation.scopeArgs`), removing
 * it in one project must not disable it for another still referencing the shared source. */
import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { describe, expect, it } from "vitest";
import {
  FRAMEWORK_MARKETPLACE_NAME,
  Marketplace,
} from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { PluginRemoveUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-remove-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { UserSourceReferencesAdapter } from "../../../../../src/contexts/framework/infrastructure/user-source-references-adapter.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

const PROJECT_ROOT = "/test-project";
const OTHER_PROJECT = "/other-project";
const USER_CONFIG_DIR = "/fake-home/.config/aidd";
const PLUGIN_NAME = "aidd-vcs";
const REF = `${PLUGIN_NAME}@${FRAMEWORK_MARKETPLACE_NAME}`;

function proof() {
  return {
    kind: "effective-list" as const,
    root: "/exact/codex/root",
    sourceType: "local",
    source: "/plugin-source",
  };
}

function sourceReader() {
  return {
    read: async () => ({
      location: "/codex/plugin/marketplace/list",
      entries: new Map(
        [FRAMEWORK_MARKETPLACE_NAME, "upstream", "other-mkt", "gone-mkt"].map((name) => [
          name,
          proof(),
        ])
      ),
    }),
  };
}

function seedManifest(
  marketplaceAlias: string = FRAMEWORK_MARKETPLACE_NAME,
  recordNativeRegistration = true
): Manifest {
  const manifest = Manifest.create();
  manifest.addTool("codex", "1.0.0", []);
  manifest.addPlugin(
    "codex",
    InstalledPlugin.fromJSON({
      name: PLUGIN_NAME,
      source: { kind: "local", path: "/plugin-source" },
      version: "1.0.0",
      strict: true,
      files: {},
      scope: "project",
      marketplace: marketplaceAlias,
    })
  );
  if (recordNativeRegistration)
    manifest.setNativeRegistrations("codex", {
      binary: "codex",
      marketplaces: [{ alias: marketplaceAlias, hostName: marketplaceAlias, provenance: proof() }],
      pluginRefs: [`${PLUGIN_NAME}@${marketplaceAlias}`],
    });
  return manifest;
}

function seedSharedMarketplaceRegistry(
  marketplaceAlias: string = FRAMEWORK_MARKETPLACE_NAME
): InMemoryMarketplaceRegistry {
  const registry = new InMemoryMarketplaceRegistry();
  registry.save(
    PROJECT_ROOT,
    Marketplace.create({
      name: marketplaceAlias,
      source: { kind: "local", path: "/some/built/path" },
      scope: "user",
      addedAt: "2026-01-01T00:00:00.000Z",
    })
  );
  return registry;
}

function seedReferences(fs: InMemoryFileAdapter, roots: readonly string[]): void {
  fs.setFile(
    `${USER_CONFIG_DIR}/references.json`,
    JSON.stringify({ "1.0.0": [PROJECT_ROOT, ...roots] })
  );
  // This project's own directory exists too, exactly like `clean`'s own guard test —
  // `listAllReferencingProjects` filters by `fs.fileExists`.
  fs.setFile(`${PROJECT_ROOT}/marker`, "");
  for (const root of roots) fs.setFile(`${root}/marker`, "");
}

function buildUseCase(
  fs: InMemoryFileAdapter,
  activator: FakeNativePluginActivator,
  logger: CapturingLogger,
  manifest: Manifest = seedManifest(),
  marketplaceRegistry: InMemoryMarketplaceRegistry = seedSharedMarketplaceRegistry(),
  userManifestRepo?: InMemoryManifestRepository
): {
  removeUseCase: PluginRemoveUseCase;
  manifestRepo: InMemoryManifestRepository;
} {
  const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
  const userSourceReferences = new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR);
  const removeUseCase = new PluginRemoveUseCase(
    fs,
    manifestRepo,
    logger,
    new Map([["codex", activator]]),
    new Map(),
    userSourceReferences,
    marketplaceRegistry,
    userManifestRepo,
    new Map([["codex", sourceReader()]])
  );
  return { removeUseCase, manifestRepo };
}

describe("plugin remove guards a ref another project on this machine still needs", () => {
  it("refuses a machine-global ref without a canonical machine claim even when source and references look AIDD-owned", async () => {
    const fs = new InMemoryFileAdapter({}, new DeterministicHasher());
    seedReferences(fs, []);
    fs.setFile(`${PROJECT_ROOT}/user-note.md`, "user bytes");
    const activator = new FakeNativePluginActivator({ available: true });
    const { removeUseCase, manifestRepo } = buildUseCase(fs, activator, new CapturingLogger());
    const savesBefore = manifestRepo.saveCount;

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: ["codex"],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/canonical machine claim|unclaimed machine-global/);

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(manifestRepo.saveCount).toBe(savesBefore);
    expect(manifestRepo.getCurrent()?.getPlugins("codex")).toHaveLength(1);
    expect(manifestRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginRefs).toEqual([REF]);
    expect(fs.getFile(`${PROJECT_ROOT}/user-note.md`)).toBe("user bytes");
  });

  it("detaches only A's canonical claim while B's machine-global host ref remains enabled", async () => {
    const fs = new InMemoryFileAdapter({}, new DeterministicHasher());
    seedReferences(fs, [OTHER_PROJECT]);
    const siblingRef = `aidd-dev@${FRAMEWORK_MARKETPLACE_NAME}`;
    const otherCatalogueRef = `${PLUGIN_NAME}@other-mkt`;
    const untouchedRefs = [siblingRef, otherCatalogueRef];
    const project = seedManifest();
    project.addPlugin(
      "codex",
      InstalledPlugin.fromJSON({
        name: "aidd-dev",
        source: { kind: "local", path: "/plugin-source" },
        version: "1.0.0",
        strict: true,
        files: {},
        scope: "project",
        marketplace: FRAMEWORK_MARKETPLACE_NAME,
      })
    );
    const marketplaces = [
      { alias: "other-mkt", hostName: "other-mkt", provenance: proof() },
      {
        alias: FRAMEWORK_MARKETPLACE_NAME,
        hostName: FRAMEWORK_MARKETPLACE_NAME,
        provenance: proof(),
      },
    ];
    project.setNativeRegistrations("codex", {
      binary: "codex",
      marketplaces,
      pluginRefs: [REF, ...untouchedRefs],
    });
    fs.setFile(`${OTHER_PROJECT}/plugin-content.md`, "B's plugin bytes");
    fs.setFile(`${PROJECT_ROOT}/user-note.md`, "user bytes");
    const machine = Manifest.create();
    machine.addTool("codex", "1.0.0", []);
    machine.setNativeRegistrations("codex", {
      binary: "codex",
      marketplaces,
      pluginRefs: [REF, ...untouchedRefs],
      pluginClaims: [REF, ...untouchedRefs].map((ref) => ({
        ref,
        dependents: [PROJECT_ROOT, OTHER_PROJECT],
      })),
    });
    const userRepo = new InMemoryManifestRepository(machine);
    const activator = new FakeNativePluginActivator({ available: true });
    const { removeUseCase, manifestRepo } = buildUseCase(
      fs,
      activator,
      new CapturingLogger(),
      project,
      seedSharedMarketplaceRegistry(),
      userRepo
    );

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["codex"],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(
      manifestRepo
        .getCurrent()
        ?.getPlugins("codex")
        .map((plugin) => plugin.name)
    ).toEqual(["aidd-dev"]);
    expect(manifestRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginRefs).toEqual(
      untouchedRefs
    );
    expect(manifestRepo.getCurrent()?.getNativeRegistrations("codex")?.marketplaces).toEqual(
      marketplaces
    );
    expect(userRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: REF, dependents: [OTHER_PROJECT] },
      ...untouchedRefs.map((ref) => ({ ref, dependents: [PROJECT_ROOT, OTHER_PROJECT] })),
    ]);
    expect(userRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginRefs).toEqual([
      REF,
      ...untouchedRefs,
    ]);
    expect(userRepo.getCurrent()?.getNativeRegistrations("codex")?.marketplaces).toEqual(
      marketplaces
    );
    expect(fs.getFile(`${OTHER_PROJECT}/plugin-content.md`)).toBe("B's plugin bytes");
    expect(fs.getFile(`${PROJECT_ROOT}/user-note.md`)).toBe("user bytes");
  });

  it("refuses an unclaimed machine-global ref by hostName even when its alias is shared", async () => {
    const HOST_NAME = "upstream";
    const HOST_REF = `${PLUGIN_NAME}@${HOST_NAME}`;
    const fs = new InMemoryFileAdapter({}, new DeterministicHasher());
    seedReferences(fs, [OTHER_PROJECT]);
    const activator = new FakeNativePluginActivator({ available: true });
    const manifest = seedManifest();
    manifest.setNativeRegistrations("codex", {
      binary: "codex",
      marketplaces: [
        { alias: FRAMEWORK_MARKETPLACE_NAME, hostName: HOST_NAME, provenance: proof() },
      ],
      pluginRefs: [],
    });
    const { removeUseCase, manifestRepo } = buildUseCase(
      fs,
      activator,
      new CapturingLogger(),
      manifest
    );

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: ["codex"],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(new RegExp(`${HOST_REF}.*unclaimed machine-global`));

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(manifestRepo.getCurrent()?.getPlugins("codex")).toHaveLength(1);
  });

  it("refuses legacy removal without native registrations before any host or local mutation", async () => {
    const fs = new InMemoryFileAdapter({}, new DeterministicHasher());
    seedReferences(fs, []);
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildUseCase(
      fs,
      activator,
      logger,
      seedManifest(FRAMEWORK_MARKETPLACE_NAME, false)
    );

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: ["codex"],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/no recorded native catalogue source/);

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(manifestRepo.getCurrent()?.getPlugins("codex")).toHaveLength(1);
    expect(logger.warnMessages).toEqual([]);
  });

  describe("a machine-global ref outside the shared source", () => {
    it("refuses an unclaimed ref even when another marketplace is unrelated to the framework source", async () => {
      const fs = new InMemoryFileAdapter({}, new DeterministicHasher());
      seedReferences(fs, [OTHER_PROJECT]);
      const activator = new FakeNativePluginActivator({ available: true });
      const logger = new CapturingLogger();
      const registry = seedSharedMarketplaceRegistry();
      await registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: "other-mkt",
          source: { kind: "local", path: "/other/built/path" },
          scope: "user",
          addedAt: "2026-01-01T00:00:00.000Z",
        })
      );
      const { removeUseCase, manifestRepo } = buildUseCase(
        fs,
        activator,
        logger,
        seedManifest("other-mkt"),
        registry
      );

      await expect(
        removeUseCase.execute({
          pluginName: PLUGIN_NAME,
          toolIds: ["codex"],
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(/unclaimed machine-global/);

      expect(activator.uninstalledPlugins).toStrictEqual([]);
      expect(manifestRepo.getCurrent()?.getPlugins("codex")).toHaveLength(1);
    });

    it("refuses an unclaimed ref whose marketplace the project's local registry no longer lists", async () => {
      const fs = new InMemoryFileAdapter({}, new DeterministicHasher());
      seedReferences(fs, [OTHER_PROJECT]);
      const activator = new FakeNativePluginActivator({ available: true });
      const logger = new CapturingLogger();
      const { removeUseCase, manifestRepo } = buildUseCase(
        fs,
        activator,
        logger,
        seedManifest("gone-mkt")
      );

      await expect(
        removeUseCase.execute({
          pluginName: PLUGIN_NAME,
          toolIds: ["codex"],
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(/unclaimed machine-global/);

      expect(activator.uninstalledPlugins).toStrictEqual([]);
      expect(manifestRepo.getCurrent()?.getPlugins("codex")).toHaveLength(1);
    });
  });

  describe("without one of the optional shared-source registries", () => {
    it("still refuses unclaimed machine-global removal without references.json", async () => {
      const fs = new InMemoryFileAdapter({}, new DeterministicHasher());
      seedReferences(fs, [OTHER_PROJECT]);
      const activator = new FakeNativePluginActivator({ available: true });
      const removeUseCase = new PluginRemoveUseCase(
        fs,
        new InMemoryManifestRepository(seedManifest(), PROJECT_ROOT),
        new CapturingLogger(),
        new Map([["codex", activator]]),
        new Map(),
        undefined,
        seedSharedMarketplaceRegistry(),
        undefined,
        new Map([["codex", sourceReader()]])
      );

      await expect(
        removeUseCase.execute({
          pluginName: PLUGIN_NAME,
          toolIds: ["codex"],
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(/unclaimed machine-global/);

      expect(activator.uninstalledPlugins).toStrictEqual([]);
    });

    it("still refuses unclaimed machine-global removal without a local marketplace registry", async () => {
      const fs = new InMemoryFileAdapter({}, new DeterministicHasher());
      seedReferences(fs, [OTHER_PROJECT]);
      const activator = new FakeNativePluginActivator({ available: true });
      const removeUseCase = new PluginRemoveUseCase(
        fs,
        new InMemoryManifestRepository(seedManifest(), PROJECT_ROOT),
        new CapturingLogger(),
        new Map([["codex", activator]]),
        new Map(),
        new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR),
        undefined,
        undefined,
        new Map([["codex", sourceReader()]])
      );

      await expect(
        removeUseCase.execute({
          pluginName: PLUGIN_NAME,
          toolIds: ["codex"],
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(/unclaimed machine-global/);

      expect(activator.uninstalledPlugins).toStrictEqual([]);
    });
  });
});
