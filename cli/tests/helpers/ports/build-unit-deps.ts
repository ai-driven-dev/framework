import { resolve } from "node:path";
import { wireTools } from "../../../src/composition/tools.js";
import { PluginCatalogRepositoryAdapter } from "../../../src/contexts/distribution/infrastructure/plugin-catalog-repository-adapter.js";
import { DoctorLayoutUseCase } from "../../../src/contexts/framework/application/doctor/doctor-layout-use-case.js";
import { DoctorMergeFilesUseCase } from "../../../src/contexts/framework/application/doctor/doctor-merge-files-use-case.js";
import { DoctorPluginUseCase } from "../../../src/contexts/framework/application/doctor/doctor-plugin-use-case.js";
import { DoctorReferencesUseCase } from "../../../src/contexts/framework/application/doctor/doctor-references-use-case.js";
import { DoctorRegistrationUseCase } from "../../../src/contexts/framework/application/doctor/doctor-registration-use-case.js";
import { DoctorTrackedFilesUseCase } from "../../../src/contexts/framework/application/doctor/doctor-tracked-files-use-case.js";
import { DoctorUseCase } from "../../../src/contexts/framework/application/doctor/doctor-use-case.js";
import { InspectHostRegistration } from "../../../src/contexts/host-registration/application/inspect-host-registration.js";
import { InitProject } from "../../../src/contexts/installation/application/init-project.js";
import { InstallIdeConfig } from "../../../src/contexts/installation/application/install/install-ide-config.js";
import { InstallRuntimeConfig } from "../../../src/contexts/installation/application/install/install-runtime-config.js";
import { RunPostInstallPipeline } from "../../../src/contexts/installation/application/install/run-post-install-pipeline.js";
import { ResolveSyncConflict } from "../../../src/contexts/installation/application/resolve-sync-conflict.js";
import { DetectPluginDrift } from "../../../src/contexts/installation/application/shared/detect-plugin-drift.js";
import { UpdateTool } from "../../../src/contexts/installation/application/update/update-tool.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { BundledAssetProviderAdapter } from "../../../src/contexts/installation/infrastructure/assets/asset-loader.js";
import { PluginDistributionReaderAdapter } from "../../../src/contexts/installation/infrastructure/plugin-distribution-reader-adapter.js";
import { CLIOutput } from "../../../src/presentation/output.js";
import type { AiToolId, IdeToolId } from "../../../src/shared/domain/tool.js";
import { FakeHostActions } from "../../contexts/host-registration/testing/fake-host-actions.js";
import { catalogOf, TOOL } from "../../contexts/tools/testing/catalog-of.js";
import { registeredManifestProbes } from "../../contexts/translate/testing/registered-manifest-probes.js";
import { marketplaceSync } from "../marketplace-sync.js";
import { DeterministicHasher } from "./deterministic-hasher.js";
import { FakeCurrentVersion } from "./fake-current-version.js";
import { fakeEnsureBuiltMarketplace } from "./fake-ensure-built-marketplace.js";
import { FixturePluginFetcher } from "./fixture-plugin-fetcher.js";
import { InMemoryFileAdapter } from "./in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "./in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "./in-memory-marketplace-registry.js";
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
  const runPostInstallPipeline = new RunPostInstallPipeline(manifestRepo, updateGitignore);
  const installRuntimeConfigUseCase = new InstallRuntimeConfig(
    fs,
    hasher,
    logger,
    assetProvider,
    runPostInstallPipeline
  );
  const installIdeConfig = new InstallIdeConfig(
    fs,
    hasher,
    logger,
    assetProvider,
    runPostInstallPipeline
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
  const initUseCase = new InitProject(deps.fs, deps.manifestRepo);
  await initUseCase.execute({ projectRoot, tools: catalogOf() });
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
      tools: catalogOf(),
      toolId,
      projectRoot,
      manifest,
      force: false,
      version,
    });
  }
  return deps.installRuntimeConfigUseCase.execute({
    tools: catalogOf(),
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
  authReader?: ConstructorParameters<typeof DoctorLayoutUseCase>[1],
  hostRegistries: ConstructorParameters<typeof InspectHostRegistration>[1] = new Map()
): DoctorUseCase {
  return new DoctorUseCase(
    deps.manifestRepo,
    new DoctorTrackedFilesUseCase(deps.fs),
    new DoctorMergeFilesUseCase(deps.fs, deps.hasher),
    new DoctorPluginUseCase(new DetectPluginDrift(deps.fs)),
    new DoctorReferencesUseCase(deps.fs),
    new DoctorLayoutUseCase(deps.fs, authReader),
    new DoctorRegistrationUseCase(
      deps.fs,
      deps.marketplaceRegistry,
      (binary) =>
        binary === TOOL.codex &&
        deps.nativePluginActivators.get(TOOL.codex)?.isAvailable() === true,
      new InspectHostRegistration(deps.fs, hostRegistries, new Map()),
      () => "/user-cache",
      { get: () => "1.0.0" }
    )
  );
}

export { FIXTURE_DIR };
