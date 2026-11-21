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

/** What the machine-wide wirings read from the areas below them. */
interface GlobalParts {
  base: Base;
  installation: Installation;
  marketplace: Marketplace;
  plugin: Plugin;
}

/** Installing and updating a tool, and the setup of its tools. */
function wireToolLifecycle({ base, installation, marketplace, plugin }: GlobalParts) {
  const { fs, logger, prompter, manifestRepo, currentVersionProvider, tools } = base;
  const { installRuntimeConfigUseCase, installIdeConfig, propagateAiSettingsToIde } = installation;
  const installIdeToolUseCase = new InstallIdeTool(
    manifestRepo,
    installIdeConfig,
    propagateAiSettingsToIde
  );
  const installAiToolUseCase = new InstallAiTool(
    installRuntimeConfigUseCase,
    manifestRepo,
    plugin.pluginInstallFromMarketplaceUseCase,
    marketplace.syncSettingsUseCase,
    logger
  );
  const setupToolsUseCase = new InstallTools(
    manifestRepo,
    installRuntimeConfigUseCase,
    installIdeConfig
  );
  const updateToolsUseCase = new UpdateTools(
    new ListInstalledTools(manifestRepo, tools),
    new UpdateTool(
      installRuntimeConfigUseCase,
      installIdeConfig,
      new ResolveSyncConflict(fs),
      manifestRepo,
      tools
    ),
    new ResolveUpdateDecision(prompter),
    currentVersionProvider
  );
  return { installAiToolUseCase, installIdeToolUseCase, setupToolsUseCase, updateToolsUseCase };
}

/** Restoring a project from its manifest, one tool or all of them. */
function wireRestore(base: Base, installation: Installation, statusUseCase: ReportStatus) {
  const { fs, prompter, logger, manifestRepo, currentVersionProvider, platform, tools } = base;
  const restoreToolFiles = new RestoreToolFiles(
    new GenerateToolDistribution(
      new InstallConfig(fs),
      contentSectionInstallers(),
      platform,
      installation.assetProvider
    ),
    fs,
    prompter,
    logger,
    tools
  );
  const restoreAllPlugins = new RestoreAllPlugins(
    new ApplyPluginFiles(
      fs,
      base.pluginFetcher,
      base.pluginDistributionReader,
      installation.builtMaterializationDeps
    ),
    tools
  );
  const restoreUseCase = new Restore(fs, manifestRepo, restoreToolFiles, restoreAllPlugins, tools);
  const restoreAllUseCase = new RestoreAll(
    prompter,
    statusUseCase,
    new RestoreGlobal(manifestRepo, restoreUseCase)
  );
  const restoreToolUseCase = new RestoreTool(manifestRepo, restoreUseCase, currentVersionProvider);
  return { restoreAllUseCase, restoreToolUseCase };
}

/** The machine-wide commands: install and update tools, setup machine scope, status and restore. */
export function wireGlobal(parts: GlobalParts) {
  const { base, installation, marketplace, plugin } = parts;
  const { fs, logger, currentVersionProvider, manifestRepo, userManifestRepo, tools } = base;
  const { syncSettingsUseCase, resolveSetupSource, registerSetupSource } = marketplace;
  const installGlobalPlugins = new InstallGlobalPlugins(
    new ListFrameworkPlugins(base.marketplaceRegistry, base.resolveMarketplaceUseCase),
    new InstallUserPlugins(userManifestRepo, plugin.userPluginFileUpdater, logger, tools)
  );
  const setupMachineScope = new SetupMachineScope(
    new ConfigureMachineScope(userManifestRepo, currentVersionProvider),
    resolveSetupSource,
    registerSetupSource,
    userScopeSyncOf(syncSettingsUseCase),
    installGlobalPlugins
  );
  const statusUseCase = new ReportStatus(
    fs,
    manifestRepo,
    installation.detectPluginDriftUseCase,
    tools
  );
  return {
    ...wireToolLifecycle(parts),
    ...wireRestore(base, installation, statusUseCase),
    projectContextDetector: new DetectProjectContext(fs),
    setupMachineScope,
    statusUseCase,
    statusAllUseCase: new ReportAllStatus(statusUseCase),
  };
}

export type Global = ReturnType<typeof wireGlobal>;
