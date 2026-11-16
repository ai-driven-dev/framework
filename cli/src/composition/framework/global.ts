import { ListFrameworkPlugins } from "../../contexts/distribution/application/plugin-source/list-framework-plugins.js";
import { DetectProjectContext } from "../../contexts/installation/application/detect-project-context.js";
import { ConfigureMachineScope } from "../../contexts/installation/application/install/configure-machine-scope.js";
import { InstallAiTool } from "../../contexts/installation/application/install/install-ai-tool.js";
import { InstallIdeTool } from "../../contexts/installation/application/install/install-ide-tool.js";
import { InstallTools } from "../../contexts/installation/application/install/install-tools.js";
import { InstallUserPlugins } from "../../contexts/installation/application/install/install-user-plugins.js";
import { ListInstalledTools } from "../../contexts/installation/application/list-installed-tools.js";
import { ReportStatus } from "../../contexts/installation/application/report-status.js";
import { ResolveSyncConflict } from "../../contexts/installation/application/resolve-sync-conflict.js";
import { Restore } from "../../contexts/installation/application/restore/restore.js";
import { RestoreGlobal } from "../../contexts/installation/application/restore/restore-global.js";
import { UpdateTool } from "../../contexts/installation/application/update/update-tool.js";
import { ReportAllStatus } from "../../orchestration/global/report-all-status.js";
import { ResolveUpdateDecision } from "../../orchestration/global/resolve-update-decision.js";
import { RestoreAll } from "../../orchestration/global/restore-all.js";
import { UpdateTools } from "../../orchestration/global/update-tools.js";
import { InstallGlobalPlugins } from "../../orchestration/setup/install-global-plugins.js";
import {
  SetupMachineScope,
  type SyncMachineScope,
} from "../../orchestration/setup/setup-machine-scope.js";
import type { SyncSettings } from "../../orchestration/sync/sync-settings.js";
import type { Base } from "./base.js";
import type { Installation } from "./installation.js";
import type { Marketplace } from "./marketplace.js";
import type { Plugin } from "./plugin.js";

/** Native activation machine-wide: the project sync, bound to the user scope. */
export function userScopeSyncOf(sync: Pick<SyncSettings, "execute">): SyncMachineScope {
  return (options) => sync.execute({ ...options, scope: "user" });
}

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
  const installAiToolUseCase = new InstallAiTool(
    installRuntimeConfigUseCase,
    manifestRepo,
    pluginInstallFromMarketplaceUseCase,
    marketplaceSyncSettingsUseCase,
    logger
  );
  const setupToolsUseCase = new InstallTools(
    manifestRepo,
    installRuntimeConfigUseCase,
    installIdeConfig
  );
  const projectContextDetector = new DetectProjectContext(fs);
  const installGlobalPlugins = new InstallGlobalPlugins(
    new ListFrameworkPlugins(marketplaceRegistry, resolveMarketplaceUseCase),
    new InstallUserPlugins(userManifestRepo, userPluginFileUpdater, logger)
  );
  const setupMachineScope = new SetupMachineScope(
    new ConfigureMachineScope(userManifestRepo, currentVersionProvider),
    setupMarketplaceRegistration,
    userScopeSyncOf(marketplaceSyncSettingsUseCase),
    installGlobalPlugins
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
  const statusAllUseCase = new ReportAllStatus(statusUseCase);
  const restoreAllUseCase = new RestoreAll(
    prompter,
    statusUseCase,
    new RestoreGlobal(manifestRepo, restoreUseCase)
  );
  const updateToolsUseCase = new UpdateTools(
    new ListInstalledTools(manifestRepo),
    new UpdateTool(
      installRuntimeConfigUseCase,
      installIdeConfig,
      new ResolveSyncConflict(fs),
      manifestRepo,
      fs
    ),
    new ResolveUpdateDecision(prompter),
    currentVersionProvider
  );
  return {
    installAiToolUseCase,
    installIdeToolUseCase,
    setupToolsUseCase,
    projectContextDetector,
    setupMachineScope,
    statusUseCase,
    restoreUseCase,
    statusAllUseCase,
    restoreAllUseCase,
    updateToolsUseCase,
  };
}

export type Global = ReturnType<typeof wireGlobal>;
