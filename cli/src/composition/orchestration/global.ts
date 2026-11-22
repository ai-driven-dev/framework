import { ListFrameworkPlugins } from "../../contexts/distribution/application/plugin-source/list-framework-plugins.use-case.js";
import { DetectProjectContext } from "../../contexts/installation/application/detect-project-context.use-case.js";
import { ConfigureMachineScope } from "../../contexts/installation/application/install/configure-machine-scope.use-case.js";
import { InstallAiTool } from "../../contexts/installation/application/install/install-ai-tool.use-case.js";
import { InstallConfig } from "../../contexts/installation/application/install/install-config.use-case.js";
import { InstallIdeTool } from "../../contexts/installation/application/install/install-ide-tool.use-case.js";
import { InstallTools } from "../../contexts/installation/application/install/install-tools.use-case.js";
import { InstallUserPlugins } from "../../contexts/installation/application/install/install-user-plugins.use-case.js";
import { ListInstalledTools } from "../../contexts/installation/application/list-installed-tools.use-case.js";
import { ReportStatus } from "../../contexts/installation/application/report-status.use-case.js";
import { ResolveSyncConflict } from "../../contexts/installation/application/resolve-sync-conflict.use-case.js";
import { ApplyPluginFiles } from "../../contexts/installation/application/restore/apply-plugin-files.use-case.js";
import { GenerateToolDistribution } from "../../contexts/installation/application/restore/generate-tool-distribution.use-case.js";
import { RestoreGlobal } from "../../contexts/installation/application/restore/project/restore-global.use-case.js";
import { RestoreTool } from "../../contexts/installation/application/restore/project/restore-tool.use-case.js";
import { Restore } from "../../contexts/installation/application/restore/restore.use-case.js";
import { RestoreAllPlugins } from "../../contexts/installation/application/restore/restore-all-plugins.use-case.js";
import { RestoreToolFiles } from "../../contexts/installation/application/restore/restore-tool-files.use-case.js";
import { UpdateTool } from "../../contexts/installation/application/update/update-tool.use-case.js";
import { reportAllStatus } from "../../orchestration/global/report-all-status.js";
import { ResolveUpdateDecision } from "../../orchestration/global/resolve-update-decision.use-case.js";
import { RestoreAll } from "../../orchestration/global/restore-all.use-case.js";
import { UpdateTools } from "../../orchestration/global/update-tools.use-case.js";
import { InstallGlobalPlugins } from "../../orchestration/setup/install-global-plugins.use-case.js";
import {
  SetupMachineScope,
  type SyncMachineScope,
} from "../../orchestration/setup/setup-machine-scope.use-case.js";
import { RunSync } from "../../orchestration/sync/run-sync.use-case.js";
import { RunUserScopeSync } from "../../orchestration/sync/run-user-scope-sync.use-case.js";
import type { SyncSettings } from "../../orchestration/sync/sync-settings.use-case.js";
import type { Installation } from "../installation.js";
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

/** Updating every installed tool, asking before a changed file is overwritten. */
function wireUpdateTools(base: Base, installation: Installation) {
  const { fs, prompter, manifestRepo, currentVersionProvider, tools } = base;
  return new UpdateTools({
    listInstalledTools: new ListInstalledTools(manifestRepo, tools),
    updateTool: new UpdateTool(
      {
        installRuntimeConfig: installation.installRuntimeConfigUseCase,
        installIdeConfig: installation.installIdeConfig,
        resolveSyncConflict: new ResolveSyncConflict(fs),
        manifestRepo,
      },
      tools
    ),
    resolveUpdateDecision: new ResolveUpdateDecision(prompter),
    versionReader: currentVersionProvider,
  });
}

/** Installing and updating a tool, and the setup of its tools. */
function wireToolLifecycle({ base, installation, marketplace, plugin }: GlobalParts) {
  const { logger, manifestRepo } = base;
  const { installRuntimeConfigUseCase, installIdeConfig, propagateAiSettingsToIde } = installation;
  const installIdeToolUseCase = new InstallIdeTool(
    manifestRepo,
    installIdeConfig,
    propagateAiSettingsToIde
  );
  const installAiToolUseCase = new InstallAiTool({
    installRuntimeConfig: installRuntimeConfigUseCase,
    manifestRepo,
    pluginInstallFromMarketplace: plugin.pluginInstallFromMarketplaceUseCase,
    activatePropagated: marketplace.syncSettingsUseCase,
    logger,
  });
  const setupToolsUseCase = new InstallTools(
    manifestRepo,
    installRuntimeConfigUseCase,
    installIdeConfig
  );
  const updateToolsUseCase = wireUpdateTools(base, installation);
  return { installAiToolUseCase, installIdeToolUseCase, setupToolsUseCase, updateToolsUseCase };
}

/** Restoring a project from its manifest, one tool or all of them. */
function wireRestore(base: Base, installation: Installation, statusUseCase: ReportStatus) {
  const { fs, prompter, logger, manifestRepo, currentVersionProvider, platform, tools } = base;
  const restoreToolFiles = new RestoreToolFiles(
    {
      generateToolDistribution: new GenerateToolDistribution(
        new InstallConfig(fs),
        platform,
        installation.assetProvider
      ),
      fs,
      conflicts: prompter,
      logger,
    },
    tools
  );
  const restoreAllPlugins = new RestoreAllPlugins(
    new ApplyPluginFiles({
      fs,
      loadDistribution: base.loadDistribution,
      builtDeps: installation.builtMaterializationDeps,
    }),
    tools
  );
  const restoreUseCase = new Restore(
    { fs, manifestRepo, restoreToolFiles, restoreAllPlugins },
    tools
  );
  const restoreAllUseCase = new RestoreAll(
    prompter,
    statusUseCase,
    new RestoreGlobal(manifestRepo, restoreUseCase)
  );
  const restoreToolUseCase = new RestoreTool(manifestRepo, restoreUseCase, currentVersionProvider);
  return { restoreAllUseCase, restoreToolUseCase };
}

/** Setting the machine scope up: its settings, its source and the plugins installed for it. */
function wireMachineScope({ base, marketplace, plugin }: GlobalParts) {
  const { logger, currentVersionProvider, userManifestRepo, tools } = base;
  const installGlobalPlugins = new InstallGlobalPlugins(
    new ListFrameworkPlugins(base.marketplaceRegistry, base.resolveMarketplaceUseCase),
    new InstallUserPlugins(
      { repo: userManifestRepo, materializer: plugin.userPluginFileUpdater, logger },
      tools
    )
  );
  return new SetupMachineScope({
    configureMachineScope: new ConfigureMachineScope(userManifestRepo, currentVersionProvider),
    resolveSource: marketplace.resolveSetupSource,
    register: marketplace.registerSetupSource,
    syncMachineScope: userScopeSyncOf(marketplace.syncSettingsUseCase),
    installPlugins: installGlobalPlugins,
  });
}

/** The machine-wide commands: install and update tools, setup machine scope, status and restore. */
export function wireGlobal(parts: GlobalParts) {
  const { base, installation, marketplace, plugin } = parts;
  const { fs, manifestRepo, tools } = base;
  const { syncSettingsUseCase } = marketplace;
  const statusUseCase = new ReportStatus(
    { fs, manifestRepo, detectPluginDrift: installation.detectPluginDriftUseCase },
    tools
  );
  const restore = wireRestore(base, installation, statusUseCase);
  return {
    ...wireToolLifecycle(parts),
    ...restore,
    runSync: new RunSync(
      restore.restoreAllUseCase,
      restore.restoreToolUseCase,
      syncSettingsUseCase
    ),
    runUserScopeSync: new RunUserScopeSync(
      {
        machine: installation.readMachineInstallation,
        userPlugins: plugin.userPluginUpdateUseCase,
        syncSettings: syncSettingsUseCase,
      },
      tools
    ),
    projectContextDetector: new DetectProjectContext(fs),
    setupMachineScope: wireMachineScope(parts),
    statusUseCase,
    statusAllUseCase: {
      execute: (projectRoot: string) => reportAllStatus(statusUseCase, projectRoot),
    },
  };
}

export type Global = ReturnType<typeof wireGlobal>;
