import { RestoreAllUseCase } from "../../contexts/framework/application/global/restore-all-use-case.js";
import { InstallAiToolUseCase } from "../../contexts/framework/application/install/install-ai-tool-use-case.js";
import { InstallGlobalPluginsUseCase } from "../../contexts/framework/application/setup/install-global-plugins-use-case.js";
import { SetupMachineScopeUseCase } from "../../contexts/framework/application/setup/setup-machine-scope-use-case.js";
import { DetectProjectContext } from "../../contexts/installation/application/detect-project-context.js";
import { InstallIdeTool } from "../../contexts/installation/application/install/install-ide-tool.js";
import { InstallTools } from "../../contexts/installation/application/install/install-tools.js";
import { ListInstalledTools } from "../../contexts/installation/application/list-installed-tools.js";
import { ReportStatus } from "../../contexts/installation/application/report-status.js";
import { ResolveSyncConflict } from "../../contexts/installation/application/resolve-sync-conflict.js";
import { Restore } from "../../contexts/installation/application/restore/restore.js";
import { UpdateTool } from "../../contexts/installation/application/update/update-tool.js";
import { ReportAllStatus } from "../../orchestration/global/report-all-status.js";
import { ResolveUpdateDecision } from "../../orchestration/global/resolve-update-decision.js";
import { UpdateTools } from "../../orchestration/global/update-tools.js";
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
  const setupToolsUseCase = new InstallTools(
    manifestRepo,
    installRuntimeConfigUseCase,
    installIdeConfig
  );
  const projectContextDetector = new DetectProjectContext(fs);
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
  const statusAllUseCase = new ReportAllStatus(statusUseCase);
  const restoreAllUseCase = new RestoreAllUseCase(
    manifestRepo,
    prompter,
    statusUseCase,
    restoreUseCase
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
    setupMachineScopeUseCase,
    statusUseCase,
    restoreUseCase,
    statusAllUseCase,
    restoreAllUseCase,
    updateToolsUseCase,
  };
}
