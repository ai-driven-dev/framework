/** At a host that enables a plugin machine-wide (no `NativeActivation.scopeArgs`), removing
 * it in one project must not disable it for another still referencing the shared source. */

import { describe, expect, it } from "vitest";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../../../src/contexts/distribution/contract/marketplace.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.js";
import { TOOL } from "../../../../shared/testing/registered-tools.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.js";
import { FakeUserSourceReferences } from "../../testing/fake-user-source-references.js";
import { InMemoryManifestRepository } from "../../testing/in-memory-manifest-repository.js";
import { aManifest } from "../../testing/manifest-builder.js";
import { pluginRemover } from "../../testing/plugin-remover.js";

const PROJECT_ROOT = "/test-project";
const OTHER_PROJECT = "/other-project";
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
  const manifest = aManifest()
    .withTool(TOOL.codex, [])
    .withPlugin(
      TOOL.codex,
      InstalledPlugin.fromJSON({
        name: PLUGIN_NAME,
        source: { kind: "local", path: "/plugin-source" },
        version: "1.0.0",
        strict: true,
        files: {},
        scope: "project",
        marketplace: marketplaceAlias,
      })
    )
    .build();
  if (recordNativeRegistration)
    manifest.setNativeRegistrations(TOOL.codex, {
      binary: "codex",
      marketplaces: [{ alias: marketplaceAlias, hostName: marketplaceAlias, provenance: proof() }],
      pluginRefs: [`${PLUGIN_NAME}@${marketplaceAlias}`],
    });
  return manifest;
}

function seedSharedMarketplaceRegistry(
  marketplaceAlias: string = FRAMEWORK_MARKETPLACE_NAME
): FakeMarketplaceRegistry {
  const registry = new FakeMarketplaceRegistry();
  registry.seed(PROJECT_ROOT, {
    name: marketplaceAlias,
    source: { kind: "local", path: "/some/built/path" },
    scope: "user",
  });
  return registry;
}

/** The projects this machine's shared source is referenced by: this one, and the others given. */
function seedReferences(
  fs: InMemoryFileAdapter,
  roots: readonly string[]
): FakeUserSourceReferences {
  fs.setFile(`${PROJECT_ROOT}/marker`, "");
  for (const root of roots) fs.setFile(`${root}/marker`, "");
  return new FakeUserSourceReferences([PROJECT_ROOT, ...roots]);
}

function buildUseCase(
  fs: InMemoryFileAdapter,
  activator: FakeHostActions,
  logger: CapturingLogger,
  userSourceReferences: FakeUserSourceReferences,
  manifest: Manifest = seedManifest(),
  marketplaceRegistry: FakeMarketplaceRegistry = seedSharedMarketplaceRegistry(),
  userManifestRepo?: InMemoryManifestRepository
): {
  removeUseCase: ReturnType<typeof pluginRemover>;
  manifestRepo: InMemoryManifestRepository;
} {
  const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
  const removeUseCase = pluginRemover({
    fs,
    manifestRepo,
    logger,
    activators: new Map([["codex", activator]]),
    userSourceReferences,
    marketplaceRegistry,
    userManifestRepo,
    nativeMarketplaceSources: new Map([[TOOL.codex, sourceReader()]]),
  });
  return { removeUseCase, manifestRepo };
}

describe("plugin remove guards a ref another project on this machine still needs", () => {
  it("refuses a machine-global ref without a canonical machine claim even when source and references look AIDD-owned", async () => {
    const fs = new InMemoryFileAdapter({});
    const references = seedReferences(fs, []);
    fs.setFile(`${PROJECT_ROOT}/user-note.md`, "user bytes");
    const activator = new FakeHostActions({ available: true });
    const { removeUseCase, manifestRepo } = buildUseCase(
      fs,
      activator,
      new CapturingLogger(),
      references
    );
    const savesBefore = manifestRepo.saveCount;

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: [TOOL.codex],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/canonical machine claim|unclaimed machine-global/);

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(manifestRepo.saveCount).toBe(savesBefore);
    expect(manifestRepo.getCurrent()?.getPlugins(TOOL.codex)).toHaveLength(1);
    expect(manifestRepo.getCurrent()?.getNativeRegistrations(TOOL.codex)?.pluginRefs).toEqual([
      REF,
    ]);
    expect(fs.getFile(`${PROJECT_ROOT}/user-note.md`)).toBe("user bytes");
  });

  it("detaches only A's canonical claim while B's machine-global host ref remains enabled", async () => {
    const fs = new InMemoryFileAdapter({});
    const references = seedReferences(fs, [OTHER_PROJECT]);
    const siblingRef = `aidd-dev@${FRAMEWORK_MARKETPLACE_NAME}`;
    const otherCatalogueRef = `${PLUGIN_NAME}@other-mkt`;
    const untouchedRefs = [siblingRef, otherCatalogueRef];
    const project = seedManifest();
    project.addPlugin(
      TOOL.codex,
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
    project.setNativeRegistrations(TOOL.codex, {
      binary: "codex",
      marketplaces,
      pluginRefs: [REF, ...untouchedRefs],
    });
    fs.setFile(`${OTHER_PROJECT}/plugin-content.md`, "B's plugin bytes");
    fs.setFile(`${PROJECT_ROOT}/user-note.md`, "user bytes");
    const machine = Manifest.create();
    machine.addTool(TOOL.codex, "1.0.0", []);
    machine.setNativeRegistrations(TOOL.codex, {
      binary: "codex",
      marketplaces,
      pluginRefs: [REF, ...untouchedRefs],
      pluginClaims: [REF, ...untouchedRefs].map((ref) => ({
        ref,
        dependents: [PROJECT_ROOT, OTHER_PROJECT],
      })),
    });
    const userRepo = new InMemoryManifestRepository(machine);
    const activator = new FakeHostActions({ available: true });
    const { removeUseCase, manifestRepo } = buildUseCase(
      fs,
      activator,
      new CapturingLogger(),
      references,
      project,
      seedSharedMarketplaceRegistry(),
      userRepo
    );

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [TOOL.codex],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(
      manifestRepo
        .getCurrent()
        ?.getPlugins(TOOL.codex)
        .map((plugin) => plugin.name)
    ).toEqual(["aidd-dev"]);
    expect(manifestRepo.getCurrent()?.getNativeRegistrations(TOOL.codex)?.pluginRefs).toEqual(
      untouchedRefs
    );
    expect(manifestRepo.getCurrent()?.getNativeRegistrations(TOOL.codex)?.marketplaces).toEqual(
      marketplaces
    );
    expect(userRepo.getCurrent()?.getNativeRegistrations(TOOL.codex)?.pluginClaims).toEqual([
      { ref: REF, dependents: [OTHER_PROJECT] },
      ...untouchedRefs.map((ref) => ({ ref, dependents: [PROJECT_ROOT, OTHER_PROJECT] })),
    ]);
    expect(userRepo.getCurrent()?.getNativeRegistrations(TOOL.codex)?.pluginRefs).toEqual([
      REF,
      ...untouchedRefs,
    ]);
    expect(userRepo.getCurrent()?.getNativeRegistrations(TOOL.codex)?.marketplaces).toEqual(
      marketplaces
    );
    expect(fs.getFile(`${OTHER_PROJECT}/plugin-content.md`)).toBe("B's plugin bytes");
    expect(fs.getFile(`${PROJECT_ROOT}/user-note.md`)).toBe("user bytes");
  });

  it("refuses an unclaimed machine-global ref by hostName even when its alias is shared", async () => {
    const HOST_NAME = "upstream";
    const HOST_REF = `${PLUGIN_NAME}@${HOST_NAME}`;
    const fs = new InMemoryFileAdapter({});
    const references = seedReferences(fs, [OTHER_PROJECT]);
    const activator = new FakeHostActions({ available: true });
    const manifest = seedManifest();
    manifest.setNativeRegistrations(TOOL.codex, {
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
      references,
      manifest
    );

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: [TOOL.codex],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(new RegExp(`${HOST_REF}.*unclaimed machine-global`));

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(manifestRepo.getCurrent()?.getPlugins(TOOL.codex)).toHaveLength(1);
  });

  it("refuses legacy removal without native registrations before any host or local mutation", async () => {
    const fs = new InMemoryFileAdapter({});
    const references = seedReferences(fs, []);
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildUseCase(
      fs,
      activator,
      logger,
      references,
      seedManifest(FRAMEWORK_MARKETPLACE_NAME, false)
    );

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: [TOOL.codex],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/no recorded native catalogue source/);

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(manifestRepo.getCurrent()?.getPlugins(TOOL.codex)).toHaveLength(1);
    expect(logger.warnMessages).toEqual([]);
  });

  describe("a machine-global ref outside the shared source", () => {
    it("refuses an unclaimed ref even when another marketplace is unrelated to the framework source", async () => {
      const fs = new InMemoryFileAdapter({});
      const references = seedReferences(fs, [OTHER_PROJECT]);
      const activator = new FakeHostActions({ available: true });
      const logger = new CapturingLogger();
      const registry = seedSharedMarketplaceRegistry();
      registry.seed(PROJECT_ROOT, {
        name: "other-mkt",
        source: { kind: "local", path: "/other/built/path" },
        scope: "user",
      });
      const { removeUseCase, manifestRepo } = buildUseCase(
        fs,
        activator,
        logger,
        references,
        seedManifest("other-mkt"),
        registry
      );

      await expect(
        removeUseCase.execute({
          pluginName: PLUGIN_NAME,
          toolIds: [TOOL.codex],
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(/unclaimed machine-global/);

      expect(activator.uninstalledPlugins).toStrictEqual([]);
      expect(manifestRepo.getCurrent()?.getPlugins(TOOL.codex)).toHaveLength(1);
    });

    it("refuses an unclaimed ref whose marketplace the project's local registry no longer lists", async () => {
      const fs = new InMemoryFileAdapter({});
      const references = seedReferences(fs, [OTHER_PROJECT]);
      const activator = new FakeHostActions({ available: true });
      const logger = new CapturingLogger();
      const { removeUseCase, manifestRepo } = buildUseCase(
        fs,
        activator,
        logger,
        references,
        seedManifest("gone-mkt")
      );

      await expect(
        removeUseCase.execute({
          pluginName: PLUGIN_NAME,
          toolIds: [TOOL.codex],
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(/unclaimed machine-global/);

      expect(activator.uninstalledPlugins).toStrictEqual([]);
      expect(manifestRepo.getCurrent()?.getPlugins(TOOL.codex)).toHaveLength(1);
    });
  });

  describe("without one of the optional shared-source registries", () => {
    it("still refuses unclaimed machine-global removal without references.json", async () => {
      const fs = new InMemoryFileAdapter({});
      seedReferences(fs, [OTHER_PROJECT]);
      const activator = new FakeHostActions({ available: true });
      const removeUseCase = pluginRemover({
        fs,
        manifestRepo: new InMemoryManifestRepository(seedManifest(), PROJECT_ROOT),
        activators: new Map([["codex", activator]]),
        marketplaceRegistry: seedSharedMarketplaceRegistry(),
        nativeMarketplaceSources: new Map([[TOOL.codex, sourceReader()]]),
      });

      await expect(
        removeUseCase.execute({
          pluginName: PLUGIN_NAME,
          toolIds: [TOOL.codex],
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(/unclaimed machine-global/);

      expect(activator.uninstalledPlugins).toStrictEqual([]);
    });

    it("still refuses unclaimed machine-global removal without a local marketplace registry", async () => {
      const fs = new InMemoryFileAdapter({});
      const references = seedReferences(fs, [OTHER_PROJECT]);
      const activator = new FakeHostActions({ available: true });
      const removeUseCase = pluginRemover({
        fs,
        manifestRepo: new InMemoryManifestRepository(seedManifest(), PROJECT_ROOT),
        activators: new Map([["codex", activator]]),
        userSourceReferences: references,
        nativeMarketplaceSources: new Map([[TOOL.codex, sourceReader()]]),
      });

      await expect(
        removeUseCase.execute({
          pluginName: PLUGIN_NAME,
          toolIds: [TOOL.codex],
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(/unclaimed machine-global/);

      expect(activator.uninstalledPlugins).toStrictEqual([]);
    });
  });
});
