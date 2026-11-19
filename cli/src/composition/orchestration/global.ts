import { ListFrameworkPlugins } from "../../contexts/distribution/application/plugin-source/list-framework-plugins.js";
import { DetectProjectContext } from "../../contexts/installation/application/detect-project-context.js";
import { ConfigureMachineScope } from "../../contexts/installation/application/install/configure-machine-scope.js";
import { InstallAiTool } from "../../contexts/installation/application/install/install-ai-tool.js";
import { InstallConfig } from "../../contexts/installation/application/install/install-config.js";
import { InstallIdeTool } from "../../contexts/installation/application/install/install-ide-tool.js";
import { InstallTools } from "../../contexts/installation/application/install/install-tools.js";
import { InstallUserPlugins } from "../../contexts/installation/application/install/install-user-plugins.js";
import { ListInstalledTools } from "../../contexts/installation/application/list-installed-tools.js";
import { ReportStatus } from "../../contexts/installation/application/report-status.js";
import { ResolveSyncConflict } from "../../contexts/installation/application/resolve-sync-conflict.js";
import { ApplyPluginFiles } from "../../contexts/installation/application/restore/apply-plugin-files.js";
import { GenerateToolDistribution } from "../../contexts/installation/application/restore/generate-tool-distribution.js";
import { RestoreGlobal } from "../../contexts/installation/application/restore/project/restore-global.js";
import { RestoreTool } from "../../contexts/installation/application/restore/project/restore-tool.js";
import { Restore } from "../../contexts/installation/application/restore/restore.js";
import { RestoreAllPlugins } from "../../contexts/installation/application/restore/restore-all-plugins.js";
import { RestoreToolFiles } from "../../contexts/installation/application/restore/restore-tool-files.js";
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
import { contentSectionInstallers, type Installation } from "../installation.js";
import type { Base } from "../shared.js";
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
    installRuntimeConfigUseCase,
    installIdeConfig,
    propagateAiSettingsToIde,
    builtMaterializationDeps,
    detectPluginDriftUseCase,
  } = inst;
  const { syncSettingsUseCase, setupMarketplaceRegistration } = m;
  const { pluginInstallFromMarketplaceUseCase, userPluginFileUpdater } = p;
  const installIdeToolUseCase = new InstallIdeTool(installIdeConfig, propagateAiSettingsToIde);
  const installAiToolUseCase = new InstallAiTool(
    installRuntimeConfigUseCase,
    manifestRepo,
    pluginInstallFromMarketplaceUseCase,
    syncSettingsUseCase,
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
    new InstallUserPlugins(userManifestRepo, userPluginFileUpdater, logger, base.tools)
  );
  const setupMachineScope = new SetupMachineScope(
    new ConfigureMachineScope(userManifestRepo, currentVersionProvider),
    setupMarketplaceRegistration,
    userScopeSyncOf(syncSettingsUseCase),
    installGlobalPlugins
  );
  const statusUseCase = new ReportStatus(fs, manifestRepo, detectPluginDriftUseCase, base.tools);
  const restoreToolFiles = new RestoreToolFiles(
    new GenerateToolDistribution(
      new InstallConfig(fs),
      contentSectionInstallers(),
      platform,
      assetProvider
    ),
    fs,
    prompter,
    logger,
    base.tools
  );
  const restoreAllPlugins = new RestoreAllPlugins(
    new ApplyPluginFiles(fs, pluginFetcher, pluginDistributionReader, builtMaterializationDeps),
    base.tools
  );
  const restoreUseCase = new Restore(
    fs,
    manifestRepo,
    restoreToolFiles,
    restoreAllPlugins,
    base.tools
  );
  const statusAllUseCase = new ReportAllStatus(statusUseCase);
  const restoreAllUseCase = new RestoreAll(
    prompter,
    statusUseCase,
    new RestoreGlobal(manifestRepo, restoreUseCase)
  );
  const restoreToolUseCase = new RestoreTool(manifestRepo, restoreUseCase, currentVersionProvider);
  const updateToolsUseCase = new UpdateTools(
    new ListInstalledTools(manifestRepo, base.tools),
    new UpdateTool(
      installRuntimeConfigUseCase,
      installIdeConfig,
      new ResolveSyncConflict(fs),
      manifestRepo,
      base.tools
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
    restoreToolUseCase,
    statusAllUseCase,
    restoreAllUseCase,
    updateToolsUseCase,
  };
}

export type Global = ReturnType<typeof wireGlobal>;
