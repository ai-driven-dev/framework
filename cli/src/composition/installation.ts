import { homedir, tmpdir } from "node:os";
import type { RegistrationRecordRules } from "../contexts/host-registration/contract/registration-record-rules.js";
import { mergeCatalogueMarketplaces } from "../contexts/host-registration/domain/record/catalogue-marketplaces.js";
import {
  isRefOnHost,
  refOnHostName,
} from "../contexts/host-registration/domain/record/host-ref.js";
import { afterActivation } from "../contexts/host-registration/domain/record/registration-projection.js";
import {
  isQualifiedRef,
  marketplaceOf,
  pluginRefsOf,
  refOf,
  refSelectedBy,
  refsOnHosts,
  registrationPreview,
  withoutMarketplace,
  withoutRef,
} from "../contexts/host-registration/domain/record/registration-record.js";
import { AssertProjectMcpEntriesRemovable } from "../contexts/installation/application/assert-project-mcp-entries-removable.use-case.js";
import { ReadMachineInstallation } from "../contexts/installation/application/doctor/read-machine-installation.use-case.js";
import { InstallIdeConfig } from "../contexts/installation/application/install/config/install-ide-config.use-case.js";
import { InstallRuntimeConfig } from "../contexts/installation/application/install/config/install-runtime-config.use-case.js";
import { TrackedConfigFiles } from "../contexts/installation/application/install/config/tracked-config-files.use-case.js";
import { PropagateAiSettingsToIde } from "../contexts/installation/application/install/propagate-ai-settings-to-ide.use-case.js";
import { RunPostInstallPipeline } from "../contexts/installation/application/install/run-post-install-pipeline.use-case.js";
import { ListInstalledRules } from "../contexts/installation/application/list-installed-rules.use-case.js";
import {
  CacheBuiltMarketplace,
  type FrameworkBuilds,
} from "../contexts/installation/application/marketplace/cache-built-marketplace.use-case.js";
import { ProjectHooksMaterializer } from "../contexts/installation/application/materialize/project-hooks-materializer.use-case.js";
import { AssertProjectPathWithinRoot } from "../contexts/installation/application/ownership/assert-project-path-within-root.use-case.js";
import { ListPlugins } from "../contexts/installation/application/plugin/list-plugins.use-case.js";
import { AssertProjectIntegrationRemovable } from "../contexts/installation/application/removal/assert-project-integration-removable.use-case.js";
import { PlanProjectMcpRemoval } from "../contexts/installation/application/removal/plan-project-mcp-removal.use-case.js";
import { RemoveProjectHooks } from "../contexts/installation/application/removal/remove-project-hooks.use-case.js";
import { RemoveProjectIntegration } from "../contexts/installation/application/removal/remove-project-integration.use-case.js";
import { AssertProjectHooksRemovable } from "../contexts/installation/application/shared/assert-project-hooks-removable.use-case.js";
import { AssertProjectHooksUnchanged } from "../contexts/installation/application/shared/assert-project-hooks-unchanged.use-case.js";
import type { BuiltMaterializationDeps } from "../contexts/installation/application/shared/built-materialization-deps.js";
import { DetectPluginDrift } from "../contexts/installation/application/shared/detect-plugin-drift.use-case.js";
import { RemoveRecordedProjectHooks } from "../contexts/installation/application/shared/remove-recorded-project-hooks.use-case.js";
import { UpdateGitignore } from "../contexts/installation/application/update-gitignore.use-case.js";
import type { ProjectSetupState } from "../contexts/installation/contract/project-setup-state.js";
import { AgentModelStoreAdapter } from "../contexts/installation/infrastructure/agent-model-store-adapter.js";
import type { AgentModelStore } from "../contexts/installation/ports/agent-model-store.js";
import type { ManifestRepository } from "../contexts/installation/ports/manifest-repository.js";
import { recordClaimRules } from "../contexts/machine-claims/application/record/record-claim-rules.js";
import type { RecordClaimRules } from "../contexts/machine-claims/contract/record-claim-rules.js";
import type { ToolCatalog } from "../contexts/tools/contract/tool-catalog.js";
import { EnsureBuiltMarketplace } from "../orchestration/marketplace/ensure-built-marketplace.use-case.js";
import { BundledAssetProviderAdapter } from "../shared/infrastructure/asset-loader.js";
import type { FileReader } from "../shared/ports/file-reader.js";
import type { FileWriter } from "../shared/ports/file-writer.js";
import type { Logger } from "../shared/ports/logger.js";
import type { Base } from "./shared.js";
import {
  createFrameworkBuildUseCase,
  createPluginTranslation,
  type FrameworkBuildDeps,
} from "./translate.js";
import { userConfigDir } from "./user-config-dir.js";

/** A project is set up once the installation has recorded a manifest for it. */
export function projectSetupOf(manifestRepo: ManifestRepository): ProjectSetupState {
  return { isSetUp: async () => (await manifestRepo.load()) !== null };
}

/** The rules over a recorded registration: the host registration answers for the host data, the
 * machine claims for the claims kept beside it. */
export const registrationRecordRules: RegistrationRecordRules & RecordClaimRules = {
  pluginRefsOf,
  marketplaceOf,
  refOnHostName,
  isQualifiedRef,
  refSelectedBy,
  refOf,
  refsOnHosts,
  registrationPreview,
  withoutRef,
  afterActivation,
  ...recordClaimRules({
    marketplaceOf,
    isRefOnHost,
    withoutRef,
    withoutMarketplace,
    mergeCatalogueMarketplaces,
  }),
};

/** Builds a distribution into the aidd-owned cache, overwriting what a previous build left there. */
export function cacheBuildFor(
  tools: ToolCatalog,
  deps: FrameworkBuildDeps
): FrameworkBuilds["buildFor"] {
  return ({ target, mode, outDir, variant }) =>
    createFrameworkBuildUseCase(tools, deps, {
      target,
      mode,
      outDir,
      force: true,
      ...(variant === undefined ? {} : { provider: variant }),
    });
}

/** The cache builds, each tool's tree carrying the provider its agents run on, the variant a
 * changed provider makes stale. */
export function frameworkBuildsOf(
  tools: ToolCatalog,
  buildFor: FrameworkBuilds["buildFor"],
  store: AgentModelStore
): FrameworkBuilds {
  return {
    variant: async (target) => {
      const id = tools.aiToolId(target);
      if (id === null || tools.aiProfile(id).agentModels() === null) return undefined;
      return (await store.loadProviders())[id];
    },
    buildFor,
  };
}

/** A logger whose every level lands at debug, for work that runs behind almost every command. */
export function debugOnly(logger: Logger): Logger {
  return {
    debug: (message, cause) => logger.debug(message, cause),
    info: (message) => logger.debug(message),
    warn: (message, cause) => logger.debug(message, cause),
  };
}

/** What a restore needs to rebuild through the build pipeline. */
export function builtMaterializationDepsOf(
  fs: FileReader & FileWriter,
  build: Omit<BuiltMaterializationDeps, "projectHooks">
): BuiltMaterializationDeps {
  return { ...build, projectHooks: projectIntegrationOf(fs).materializer };
}

/** The project hooks and MCP use cases, built once over one file system. */
export function projectIntegrationOf(fs: FileReader & FileWriter) {
  const withinRoot = new AssertProjectPathWithinRoot(fs);
  const unchanged = new AssertProjectHooksUnchanged(fs, withinRoot);
  const removeRecorded = new RemoveRecordedProjectHooks({ fs, unchanged, withinRoot });
  const removeHooks = new RemoveProjectHooks(removeRecorded);
  const assertHooksRemovable = new AssertProjectHooksRemovable(unchanged);
  const plan = new PlanProjectMcpRemoval(fs, withinRoot);
  const assertMcpRemovable = new AssertProjectMcpEntriesRemovable(plan);
  return {
    materializer: new ProjectHooksMaterializer(fs, unchanged, removeRecorded),
    unchanged,
    removeRecorded,
    removeHooks,
    assertHooksRemovable,
    assertMcpRemovable,
    assertIntegration: new AssertProjectIntegrationRemovable(
      assertMcpRemovable,
      assertHooksRemovable
    ),
    removeIntegration: new RemoveProjectIntegration({ fs, plan, hooks: removeHooks, withinRoot }),
  };
}

/** What installing a tool's configuration writes, and the steps that follow each install. */
function wireConfigInstallation(base: Base, assetProvider: BundledAssetProviderAdapter) {
  const { tools, fs, logger, manifestRepo } = base;
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
  const propagateAiSettingsToIde = new PropagateAiSettingsToIde(
    { manifestRepo, trackedConfigFiles, runPostInstallPipeline, assetProvider },
    tools
  );
  return {
    updateGitignore,
    runPostInstallPipeline,
    installRuntimeConfigUseCase,
    installIdeConfig,
    propagateAiSettingsToIde,
  };
}

/** The build cache a marketplace is materialized through, and the agent models it bakes in. */
function wireBuiltMarketplace(base: Base, assetProvider: BundledAssetProviderAdapter) {
  const { tools, fs, logger, currentVersion, resolveMarketplaceUseCase } = base;
  // `force: true` is safe here: `outDir` is always an aidd-owned disposable cache, never a
  // user-owned directory, so a collision only means a previous build's cache exists. Its
  // diagnostics drop to debug because this build runs behind almost every command, where
  // they would report an implementation detail as news; `--verbose` still shows them.
  const frameworkBuildFor = cacheBuildFor(tools, {
    fs,
    assetProvider,
    logger: debugOnly(logger),
  });
  const agentModelStore = new AgentModelStoreAdapter(fs, userConfigDir);
  const cacheBuiltMarketplace = new CacheBuiltMarketplace({
    fs,
    builds: frameworkBuildsOf(tools, frameworkBuildFor, agentModelStore),
    version: currentVersion,
    userCacheRoot: userConfigDir,
    tmpdir,
  });
  const ensureBuiltMarketplaceUseCase = new EnsureBuiltMarketplace(
    resolveMarketplaceUseCase,
    cacheBuiltMarketplace
  );
  return { agentModelStore, ensureBuiltMarketplaceUseCase };
}

/** The installation context's shared commands and the build cache they read. */
export function wireInstallation(base: Base) {
  const { tools, fs, manifestRepo, userManifestRepo, marketplaceRegistry } = base;
  const assetProvider = new BundledAssetProviderAdapter(tools);
  const { agentModelStore, ensureBuiltMarketplaceUseCase } = wireBuiltMarketplace(
    base,
    assetProvider
  );
  // Restore re-materializes through the build pipeline, matching what install wrote:
  // rewriting raw content instead would itself be drift.
  const builtMaterializationDeps = builtMaterializationDepsOf(fs, {
    ensureBuilt: ensureBuiltMarketplaceUseCase,
    marketplaceRegistry,
    homedir,
    translate: createPluginTranslation(tools),
    platform: process.platform,
  });
  return {
    assetProvider,
    agentModelStore,
    ensureBuiltMarketplaceUseCase,
    ...wireConfigInstallation(base, assetProvider),
    listInstalledRulesUseCase: new ListInstalledRules(fs, process.platform, tools),
    readMachineInstallation: new ReadMachineInstallation(userManifestRepo),
    pluginListUseCase: new ListPlugins(manifestRepo, tools),
    builtMaterializationDeps,
    projectIntegration: projectIntegrationOf(fs),
    detectPluginDriftUseCase: new DetectPluginDrift(fs, tools, homedir),
    registrationRecordRules,
  };
}

export type Installation = ReturnType<typeof wireInstallation>;
