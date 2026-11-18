import { resolve } from "node:path";
import { registrationRecordRules } from "../../../src/composition/installation.js";
import { wireTools } from "../../../src/composition/tools.js";
import { PluginCatalogRepositoryAdapter } from "../../../src/contexts/distribution/infrastructure/plugin-catalog-repository-adapter.js";
import type { InspectHostRegistration } from "../../../src/contexts/host-registration/application/inspect/inspect-host-registration.js";
import { CheckFileReferences } from "../../../src/contexts/installation/application/doctor/check-file-references.js";
import { CheckMergeFiles } from "../../../src/contexts/installation/application/doctor/check-merge-files.js";
import { CheckPluginDrift } from "../../../src/contexts/installation/application/doctor/check-plugin-drift.js";
import { CheckProjectLayout } from "../../../src/contexts/installation/application/doctor/check-project-layout.js";
import { CheckTrackedFiles } from "../../../src/contexts/installation/application/doctor/check-tracked-files.js";
import { LoadManifest } from "../../../src/contexts/installation/application/doctor/load-manifest.js";
import { LoadManifestForDoctor } from "../../../src/contexts/installation/application/doctor/load-manifest-for-doctor.js";
import { InitProject } from "../../../src/contexts/installation/application/init-project.js";
import { InstallIdeConfig } from "../../../src/contexts/installation/application/install/config/install-ide-config.js";
import { InstallRuntimeConfig } from "../../../src/contexts/installation/application/install/config/install-runtime-config.js";
import { TrackedConfigFiles } from "../../../src/contexts/installation/application/install/config/tracked-config-files.js";
import { RunPostInstallPipeline } from "../../../src/contexts/installation/application/install/run-post-install-pipeline.js";
import { ResolveSyncConflict } from "../../../src/contexts/installation/application/resolve-sync-conflict.js";
import { DetectPluginDrift } from "../../../src/contexts/installation/application/shared/detect-plugin-drift.js";
import { UpdateTool } from "../../../src/contexts/installation/application/update/update-tool.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { PluginDistributionReaderAdapter } from "../../../src/contexts/installation/infrastructure/plugin-distribution-reader-adapter.js";
import { RunDoctor } from "../../../src/orchestration/doctor/run-doctor.js";
import { CLIOutput } from "../../../src/presentation/output.js";
import type { AiToolId, IdeToolId } from "../../../src/shared/domain/tool.js";
import { BundledAssetProviderAdapter } from "../../../src/shared/infrastructure/asset-loader.js";
import { FakeHostActions } from "../../contexts/host-registration/testing/fake-host-actions.js";
import { catalogOf } from "../../contexts/tools/testing/catalog-of.js";
import { registeredManifestProbes } from "../../contexts/translate/testing/registered-manifest-probes.js";
import { TOOL } from "../../shared/testing/registered-tools.js";
import { marketplaceSync } from "../marketplace-sync.js";
import { checkRegistrationOver } from "./build-check-registration.js";
import { DeterministicHasher } from "./deterministic-hasher.js";
import { FakeCurrentVersion } from "./fake-current-version.js";
import { fakeEnsureBuiltMarketplace } from "./fake-ensure-built-marketplace.js";
import { FixturePluginFetcher } from "./fixture-plugin-fetcher.js";
import { InMemoryFileAdapter } from "./in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "./in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "./in-memory-marketplace-registry.js";
import { registeredHostInspector } from "./registered-host-inspector.js";
import { seedFromDirectory } from "./seed-from-directory.js";

const FIXTURE_DIR = resolve(process.cwd(), "tests/fixtures/framework");

/** Builds in-memory deps for use-case unit tests, the file adapter pre-seeded with the
 * framework fixture content under absolute paths. */
export async function buildUnitDeps(_projectRoot: string) {
  const hasher = new DeterministicHasher();
  const fs = new InMemoryFileAdapter({}, hasher);
  const manifestRepo = new InMemoryManifestRepository();
  const userManifestRepo = new InMemoryManifestRepository();
  const logger = new CLIOutput(false);
  const assetProvider = new BundledAssetProviderAdapter(wireTools());
  const pluginFetcher = new FixturePluginFetcher();
  const pluginDistributionReader = new PluginDistributionReaderAdapter(
    fs,
    registeredManifestProbes()
  );
  const _pluginCatalogRepository = new PluginCatalogRepositoryAdapter(fs);
  const marketplaceRegistry = new InMemoryMarketplaceRegistry();
  const updateGitignore = new UpdateGitignore(fs);
  const runPostInstallPipeline = new RunPostInstallPipeline(
    manifestRepo,
    updateGitignore,
    catalogOf()
  );
  const trackedConfigFiles = new TrackedConfigFiles(fs, hasher, logger);
  const installRuntimeConfigUseCase = new InstallRuntimeConfig(
    trackedConfigFiles,
    fs,
    assetProvider,
    runPostInstallPipeline,
    catalogOf()
  );
  const installIdeConfig = new InstallIdeConfig(
    trackedConfigFiles,
    assetProvider,
    runPostInstallPipeline,
    catalogOf()
  );

  const currentVersionProvider = new FakeCurrentVersion();

  const resolveSyncConflict = new ResolveSyncConflict(fs);
  const nativePluginActivators = new Map([[TOOL.codex, new FakeHostActions()]]);
  const marketplaceSyncSettings = marketplaceSync({
    fs,
    manifestRepo,
    marketplaceRegistry,
    hasher,
    logger,
    activators: nativePluginActivators,
    ensureBuilt: fakeEnsureBuiltMarketplace(),
  });

  await seedFromDirectory(fs, FIXTURE_DIR, { useAbsolutePaths: true });

  return {
    hasher,
    fs,
    manifestRepo,
    userManifestRepo,
    registrationRecordRules,
    logger,
    assetProvider,
    pluginFetcher,
    pluginDistributionReader,
    marketplaceRegistry,
    marketplaceSyncSettings,
    nativePluginActivators,
    installRuntimeConfigUseCase,
    installIdeConfig,
    updateGitignore,
    runPostInstallPipeline,
    currentVersionProvider,
    resolveSyncConflict,
  };
}

export async function initProject(
  deps: Awaited<ReturnType<typeof buildUnitDeps>>,
  projectRoot: string
): Promise<void> {
  const initUseCase = new InitProject(
    deps.fs,
    deps.manifestRepo,
    deps.updateGitignore,
    catalogOf()
  );
  await initUseCase.execute({ projectRoot });
}

export async function installTool(
  deps: Awaited<ReturnType<typeof buildUnitDeps>>,
  projectRoot: string,
  toolId: AiToolId | IdeToolId
) {
  const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
  const version = "test";
  if (catalogOf().isIdeTool(toolId)) {
    return deps.installIdeConfig.execute({
      toolId,
      projectRoot,
      manifest,
      force: false,
      version,
    });
  }
  return deps.installRuntimeConfigUseCase.execute({
    toolId,
    projectRoot,
    manifest,
    force: false,
    version,
  });
}

export async function initAndInstall(
  deps: Awaited<ReturnType<typeof buildUnitDeps>>,
  projectRoot: string,
  toolId: AiToolId | IdeToolId
) {
  await initProject(deps, projectRoot);
  return installTool(deps, projectRoot, toolId);
}

export function buildUpdateTool(deps: Awaited<ReturnType<typeof buildUnitDeps>>): UpdateTool {
  return new UpdateTool(
    deps.installRuntimeConfigUseCase,
    deps.installIdeConfig,
    deps.resolveSyncConflict,
    deps.manifestRepo,
    deps.fs
  );
}

export function buildDoctorUseCase(
  deps: Awaited<ReturnType<typeof buildUnitDeps>>,
  hostRegistries: ConstructorParameters<typeof InspectHostRegistration>[1] = new Map()
): RunDoctor {
  const loadManifest = new LoadManifest(deps.manifestRepo);
  return new RunDoctor(
    new LoadManifestForDoctor(loadManifest),
    {
      tracked: new CheckTrackedFiles(loadManifest, deps.fs),
      merge: new CheckMergeFiles(loadManifest, deps.fs, deps.hasher),
      references: new CheckFileReferences(loadManifest, deps.fs),
      layout: new CheckProjectLayout(loadManifest, deps.fs, catalogOf()),
      plugin: new CheckPluginDrift(loadManifest, new DetectPluginDrift(deps.fs, catalogOf())),
    },
    checkRegistrationOver(
      loadManifest,
      deps.fs,
      deps.marketplaceRegistry,
      (binary) =>
        binary === TOOL.codex &&
        deps.nativePluginActivators.get(TOOL.codex)?.isAvailable() === true,
      registeredHostInspector(deps.fs, hostRegistries, new Map()),
      () => "/user-cache",
      { get: () => "1.0.0" },
      catalogOf()
    ),
    { execute: async () => [] },
    catalogOf()
  );
}

export { FIXTURE_DIR };
