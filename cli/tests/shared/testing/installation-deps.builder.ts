import { resolve } from "node:path";
import { registrationRecordRules } from "../../../src/composition/installation.js";
import { createOutput } from "../../../src/composition/shared.js";
import { wireTools } from "../../../src/composition/tools.js";
import { InitProject } from "../../../src/contexts/installation/application/init-project.js";
import { InstallIdeConfig } from "../../../src/contexts/installation/application/install/config/install-ide-config.js";
import { InstallRuntimeConfig } from "../../../src/contexts/installation/application/install/config/install-runtime-config.js";
import { TrackedConfigFiles } from "../../../src/contexts/installation/application/install/config/tracked-config-files.js";
import { RunPostInstallPipeline } from "../../../src/contexts/installation/application/install/run-post-install-pipeline.js";
import { ResolveSyncConflict } from "../../../src/contexts/installation/application/resolve-sync-conflict.js";
import { UpdateTool } from "../../../src/contexts/installation/application/update/update-tool.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { PluginDistributionReaderAdapter } from "../../../src/contexts/installation/infrastructure/plugin-distribution-reader-adapter.js";
import type { AiToolId, IdeToolId } from "../../../src/shared/domain/tool.js";
import { BundledAssetProviderAdapter } from "../../../src/shared/infrastructure/asset-loader.js";
import { FakeHostActions } from "./fake-host-actions.fake.js";
import { FixturePluginFetcher } from "./fixture-plugin-fetcher.fake.js";
import { InMemoryFileAdapter } from "./in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "./in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "./in-memory-marketplace-registry.fake.js";
import { registeredManifestProbes } from "./registered-manifest-probes.builder.js";
import { registeredTools, TOOL } from "./registered-tools.builder.js";
import { seedFromDirectory } from "./seed-from-directory.builder.js";

const FIXTURE_DIR = resolve(process.cwd(), "tests/fixtures/framework");

/** The installation commands over in-memory ports, the file adapter pre-seeded with the framework
 * fixture content under absolute paths. */
export async function buildInstallationDeps() {
  const fs = new InMemoryFileAdapter({});
  const manifestRepo = new InMemoryManifestRepository();
  const userManifestRepo = new InMemoryManifestRepository();
  const logger = createOutput(false);
  const assetProvider = new BundledAssetProviderAdapter(wireTools());
  const pluginFetcher = new FixturePluginFetcher();
  const pluginDistributionReader = new PluginDistributionReaderAdapter(
    fs,
    registeredManifestProbes()
  );
  const marketplaceRegistry = new InMemoryMarketplaceRegistry();
  const updateGitignore = new UpdateGitignore(fs);
  const runPostInstallPipeline = new RunPostInstallPipeline(
    manifestRepo,
    updateGitignore,
    registeredTools()
  );
  const trackedConfigFiles = new TrackedConfigFiles(fs, logger);
  const installRuntimeConfigUseCase = new InstallRuntimeConfig(
    trackedConfigFiles,
    fs,
    assetProvider,
    runPostInstallPipeline,
    registeredTools()
  );
  const installIdeConfig = new InstallIdeConfig(
    trackedConfigFiles,
    assetProvider,
    runPostInstallPipeline,
    registeredTools()
  );
  const resolveSyncConflict = new ResolveSyncConflict(fs);
  const nativePluginActivators = new Map([[TOOL.codex, new FakeHostActions()]]);

  await seedFromDirectory(fs, FIXTURE_DIR, { useAbsolutePaths: true });

  return {
    fs,
    manifestRepo,
    userManifestRepo,
    registrationRecordRules,
    logger,
    assetProvider,
    pluginFetcher,
    pluginDistributionReader,
    marketplaceRegistry,
    nativePluginActivators,
    trackedConfigFiles,
    installRuntimeConfigUseCase,
    installIdeConfig,
    updateGitignore,
    runPostInstallPipeline,
    resolveSyncConflict,
  };
}

type InstallationDeps = Awaited<ReturnType<typeof buildInstallationDeps>>;

export async function initProject(deps: InstallationDeps, projectRoot: string): Promise<void> {
  const initUseCase = new InitProject(
    deps.fs,
    deps.manifestRepo,
    deps.updateGitignore,
    registeredTools()
  );
  await initUseCase.execute({ projectRoot });
}

export async function installTool(
  deps: InstallationDeps,
  projectRoot: string,
  toolId: AiToolId | IdeToolId
) {
  const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
  const version = "test";
  if (registeredTools().isIdeTool(toolId)) {
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
  deps: InstallationDeps,
  projectRoot: string,
  toolId: AiToolId | IdeToolId
) {
  await initProject(deps, projectRoot);
  return installTool(deps, projectRoot, toolId);
}

export function buildUpdateTool(deps: InstallationDeps): UpdateTool {
  return new UpdateTool(
    deps.installRuntimeConfigUseCase,
    deps.installIdeConfig,
    deps.resolveSyncConflict,
    deps.manifestRepo,
    registeredTools()
  );
}

export { FIXTURE_DIR };
