import { resolve } from "node:path";
import { registrationRecordRules } from "../../../src/composition/installation.js";
import { createOutput } from "../../../src/composition/shared.js";
import { PluginDistributionReaderAdapter } from "../../../src/contexts/distribution/infrastructure/plugin-distribution-reader-adapter.js";
import { InitProject } from "../../../src/contexts/installation/application/init-project.use-case.js";
import { EnsurePluginRuntimeFiles } from "../../../src/contexts/installation/application/install/config/ensure-plugin-runtime-files.use-case.js";
import { InstallIdeConfig } from "../../../src/contexts/installation/application/install/config/install-ide-config.use-case.js";
import { InstallRuntimeConfig } from "../../../src/contexts/installation/application/install/config/install-runtime-config.use-case.js";
import { TrackedConfigFiles } from "../../../src/contexts/installation/application/install/config/tracked-config-files.use-case.js";
import { RunPostInstallPipeline } from "../../../src/contexts/installation/application/install/run-post-install-pipeline.use-case.js";
import { ResolveSyncConflict } from "../../../src/contexts/installation/application/resolve-sync-conflict.use-case.js";
import { PrepareToolUpdate } from "../../../src/contexts/installation/application/update/prepare-tool-update.use-case.js";
import {
  UpdateTool,
  type UpdateToolRequest,
  type UpdateToolResult,
} from "../../../src/contexts/installation/application/update/update-tool.use-case.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.use-case.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import type { AiToolId, IdeToolId, ToolId } from "../../../src/shared/domain/tool.js";
import { BundledAssetProviderAdapter } from "../../../src/shared/infrastructure/asset-loader.js";
import type { FakeHostActions } from "./fake-host-actions.fake.js";
import { FixturePluginFetcher } from "./fixture-plugin-fetcher.fake.js";
import { InMemoryFileAdapter } from "./in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "./in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "./in-memory-marketplace-registry.fake.js";
import { manifestProbesOf } from "./manifest-probes-of.builder.js";
import { seedFromDirectory } from "./seed-from-directory.builder.js";

const FIXTURE_DIR = resolve(process.cwd(), "tests/fixtures/framework");

export interface InstallationDepsOptions {
  /** The tools every command is wired over. */
  readonly tools: ToolCatalog;
  /** The host activators a native-plugin removal reaches, none by default. */
  readonly nativePluginActivators?: ReadonlyMap<ToolId, FakeHostActions>;
}

/** The installation commands over in-memory ports, the file adapter pre-seeded with the framework
 * fixture content under absolute paths. */
export async function buildInstallationDeps({
  tools,
  nativePluginActivators = new Map(),
}: InstallationDepsOptions) {
  const fs = new InMemoryFileAdapter({});
  const manifestRepo = new InMemoryManifestRepository();
  const userManifestRepo = new InMemoryManifestRepository();
  const logger = createOutput(false);
  const assetProvider = new BundledAssetProviderAdapter(tools);
  const pluginFetcher = new FixturePluginFetcher();
  const pluginDistributionReader = new PluginDistributionReaderAdapter(fs, manifestProbesOf(tools));
  const marketplaceRegistry = new InMemoryMarketplaceRegistry();
  const updateGitignore = new UpdateGitignore(fs);
  const runPostInstallPipeline = new RunPostInstallPipeline(manifestRepo, updateGitignore, tools);
  const trackedConfigFiles = new TrackedConfigFiles(fs, logger);
  const installRuntimeConfigUseCase = new InstallRuntimeConfig(
    { trackedConfigFiles, fs, assets: assetProvider, runPostInstallPipeline },
    tools
  );
  const installIdeConfig = new InstallIdeConfig(
    { trackedConfigFiles, assets: assetProvider, runPostInstallPipeline },
    tools
  );
  const resolveSyncConflict = new ResolveSyncConflict(fs);

  await seedFromDirectory(fs, FIXTURE_DIR, { useAbsolutePaths: true });

  return {
    tools,
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
    ensurePluginRuntimeFiles: new EnsurePluginRuntimeFiles({ fs, assets: assetProvider }),
    installIdeConfig,
    updateGitignore,
    runPostInstallPipeline,
    resolveSyncConflict,
  };
}

type InstallationDeps = Awaited<ReturnType<typeof buildInstallationDeps>>;

export async function initProject(deps: InstallationDeps, projectRoot: string): Promise<void> {
  const initUseCase = new InitProject(
    { fs: deps.fs, manifestRepo: deps.manifestRepo, updateGitignore: deps.updateGitignore },
    deps.tools
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
  if (deps.tools.isIdeTool(toolId)) {
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

/** One tool's update: what reads what it runs against, and what runs it. */
export interface ToolUpdate {
  readonly prepare: Pick<PrepareToolUpdate, "execute">;
  readonly update: Pick<UpdateTool, "execute">;
}

/** One tool's update, prepared then run, as the scenario that owns the failure policy does. */
export async function updateOf(
  { prepare, update }: ToolUpdate,
  command: UpdateToolRequest
): Promise<UpdateToolResult> {
  return update.execute(await prepare.execute(command));
}

export function buildToolUpdate(deps: InstallationDeps): {
  prepare: PrepareToolUpdate;
  update: UpdateTool;
} {
  return {
    prepare: new PrepareToolUpdate({
      resolveSyncConflict: deps.resolveSyncConflict,
      manifestRepo: deps.manifestRepo,
    }),
    update: new UpdateTool(
      {
        installRuntimeConfig: deps.installRuntimeConfigUseCase,
        installIdeConfig: deps.installIdeConfig,
      },
      deps.tools
    ),
  };
}

export { FIXTURE_DIR };
