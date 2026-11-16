import { ResolveUpdateDecisionUseCase } from "../../contexts/framework/application/global/resolve-update-decision-use-case.js";
import { RestoreAllUseCase } from "../../contexts/framework/application/global/restore-all-use-case.js";
import { StatusAllUseCase } from "../../contexts/framework/application/global/status-all-use-case.js";
import { UpdateAiToolsUseCase } from "../../contexts/framework/application/global/update-ai-tools-use-case.js";
import { UpdateIdeToolsUseCase } from "../../contexts/framework/application/global/update-ide-tools-use-case.js";
import { UpdateOneToolUseCase } from "../../contexts/framework/application/global/update-one-tool-use-case.js";
import { InstallAiToolUseCase } from "../../contexts/framework/application/install/install-ai-tool-use-case.js";
import { InstallGlobalPluginsUseCase } from "../../contexts/framework/application/setup/install-global-plugins-use-case.js";
import { ProjectContextDetectorUseCase } from "../../contexts/framework/application/setup/project-context-detector-use-case.js";
import { SetupMachineScopeUseCase } from "../../contexts/framework/application/setup/setup-machine-scope-use-case.js";
import { SetupToolsUseCase } from "../../contexts/framework/application/setup/setup-tools-use-case.js";
import { InstallIdeTool } from "../../contexts/installation/application/install/install-ide-tool.js";
import { ReportStatus } from "../../contexts/installation/application/report-status.js";
import { Restore } from "../../contexts/installation/application/restore/restore.js";
import { SyncConflictResolverUseCase } from "../../presentation/prompts/sync-conflict-resolver-use-case.js";
import type { Base } from "./base.js";
import type { Installation } from "./installation.js";
import type { Marketplace } from "./marketplace.js";
import type { Plugin } from "./plugin.js";

/** The machine-wide commands: install and update tools, setup machine scope, status and restore. */
export function wireGlobal(base: Base, inst: Installation, m: Marketplace, p: Plugin) {
  const {
    fs,
    hasher,
    logger,
    currentVersionProvider,
    platform,
    prompter,
    manifestRepo,
    userManifestRepo,
    pluginDistributionReader,
    pluginFetcher,
    marketplaceRegistry,
    resolveMarketplaceUseCase,
  } = base;
  const {
    assetProvider,
    runPostInstallPipeline,
    installRuntimeConfigUseCase,
    installIdeConfig,
    builtMaterializationDeps,
    detectPluginDriftUseCase,
  } = inst;
  const { marketplaceSyncSettingsUseCase, setupMarketplaceRegistration } = m;
  const { pluginInstallFromMarketplaceUseCase, userPluginFileUpdater } = p;
  const installIdeToolUseCase = new InstallIdeTool(
    installIdeConfig,
    manifestRepo,
    fs,
    hasher,
    runPostInstallPipeline,
    assetProvider
  );
  const installAiToolUseCase = new InstallAiToolUseCase(
    installRuntimeConfigUseCase,
    manifestRepo,
    pluginInstallFromMarketplaceUseCase,
    marketplaceSyncSettingsUseCase,
    logger
  );
  const syncConflictResolverUseCase = new SyncConflictResolverUseCase(fs);
  const setupToolsUseCase = new SetupToolsUseCase(
    manifestRepo,
    installRuntimeConfigUseCase,
    installIdeConfig
  );
  const projectContextDetector = new ProjectContextDetectorUseCase(fs);
  const setupMachineScopeUseCase = new SetupMachineScopeUseCase(
    userManifestRepo,
    setupMarketplaceRegistration,
    marketplaceSyncSettingsUseCase,
    currentVersionProvider,
    new InstallGlobalPluginsUseCase(
      marketplaceRegistry,
      resolveMarketplaceUseCase,
      userPluginFileUpdater,
      logger
    )
  );
  const statusUseCase = new ReportStatus(fs, manifestRepo, hasher, detectPluginDriftUseCase);
  const restoreUseCase = new Restore(
    fs,
    manifestRepo,
    hasher,
    logger,
    platform,
    prompter,
    pluginFetcher,
    pluginDistributionReader,
    assetProvider,
    builtMaterializationDeps
  );
  const statusAllUseCase = new StatusAllUseCase(statusUseCase);
  const restoreAllUseCase = new RestoreAllUseCase(
    manifestRepo,
    prompter,
    statusUseCase,
    restoreUseCase
  );
  const resolveUpdateDecisionUseCase = new ResolveUpdateDecisionUseCase(prompter);
  const updateOneToolUseCase = new UpdateOneToolUseCase(
    installRuntimeConfigUseCase,
    installIdeConfig,
    syncConflictResolverUseCase,
    resolveUpdateDecisionUseCase,
    fs
  );
  const updateAiToolsUseCase = new UpdateAiToolsUseCase(
    manifestRepo,
    currentVersionProvider,
    updateOneToolUseCase
  );
  const updateIdeToolsUseCase = new UpdateIdeToolsUseCase(
    manifestRepo,
    currentVersionProvider,
    updateOneToolUseCase
  );
  return {
    installAiToolUseCase,
    installIdeToolUseCase,
    setupToolsUseCase,
    projectContextDetector,
    setupMachineScopeUseCase,
    statusUseCase,
    restoreUseCase,
    statusAllUseCase,
    restoreAllUseCase,
    updateAiToolsUseCase,
    updateIdeToolsUseCase,
  };
}
