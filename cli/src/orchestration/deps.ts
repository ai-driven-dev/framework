import type { CheckStatus } from "../contexts/auth/application/check-status.use-case.js";
import type { LogIn } from "../contexts/auth/application/log-in.use-case.js";
import type { LogOut } from "../contexts/auth/application/log-out.use-case.js";
import type { ListMarketplaces } from "../contexts/distribution/application/list-marketplaces.use-case.js";
import type { SearchPlugins } from "../contexts/distribution/application/plugin-source/search-plugins.use-case.js";
import type { InstallIdeTool } from "../contexts/installation/application/install/install-ide-tool.use-case.js";
import type { ListInstalledRules } from "../contexts/installation/application/list-installed-rules.use-case.js";
import type { ListPlugins } from "../contexts/installation/application/plugin/list-plugins.use-case.js";
import type { UpdatePlugin } from "../contexts/installation/application/plugin/update-plugin.use-case.js";
import type { RemoveUserPluginRequest } from "../contexts/installation/application/removal/remove-user-plugin.use-case.js";
import type { ReportStatus } from "../contexts/installation/application/report-status.use-case.js";
import type { ValidateRecipes } from "../contexts/recipes/application/validate-recipes.use-case.js";
import type { DeclareTask } from "../contexts/telemetry/application/declaration/declare-task.use-case.js";
import type { ParseTaskFlags } from "../contexts/telemetry/application/declaration/parse-task-flags.use-case.js";
import type { ForgetTelemetry } from "../contexts/telemetry/application/forget/forget-telemetry.use-case.js";
import type { ManageIdentity } from "../contexts/telemetry/application/identity/manage-identity.use-case.js";
import type { ParseIdentityFlags } from "../contexts/telemetry/application/identity/parse-identity-flags.use-case.js";
import type { ProposeIdentity } from "../contexts/telemetry/application/identity/propose-identity.use-case.js";
import type { IngestUsage } from "../contexts/telemetry/application/ingest-usage.use-case.js";
import type { ReadTelemetryStatus } from "../contexts/telemetry/application/read-telemetry-status.use-case.js";
import type { CheckFilterValue } from "../contexts/telemetry/application/report/check-filter-value.use-case.js";
import type { ParseReportFlags } from "../contexts/telemetry/application/report/parse-report-flags.use-case.js";
import type { RequestReport } from "../contexts/telemetry/application/report/request-report.use-case.js";
import type { CheckTelemetryOn } from "../contexts/telemetry/application/switch/check-telemetry-on.use-case.js";
import type { DisableTelemetry } from "../contexts/telemetry/application/switch/disable-telemetry.use-case.js";
import type { EnableTelemetry } from "../contexts/telemetry/application/switch/enable-telemetry.use-case.js";
import type { ReadTranscriptRetention } from "../contexts/telemetry/application/switch/read-transcript-retention.use-case.js";
import type {
  BuildNativeTree,
  FrameworkBuildContext,
} from "../contexts/translate/application/build-native-tree.use-case.js";
import type { PrintUpdateNotice } from "../contexts/update/application/print-update-notice.use-case.js";
import type { RefreshUpdateCheck } from "../contexts/update/application/refresh-update-check.use-case.js";
import type { SelfUpdate } from "../contexts/update/application/self-update.use-case.js";
import type { Environment } from "../shared/ports/environment.js";
import type { Logger } from "../shared/ports/logger.js";
import type { SetAgentModels } from "./agent-models/set-agent-models.use-case.js";
import type { CleanProject } from "./clean/clean-project.use-case.js";
import type { CleanUserScope } from "./clean/clean-user-scope.use-case.js";
import type { UninstallProjectTools } from "./clean/uninstall-project-tools.use-case.js";
import type { DoctorAll } from "./doctor/doctor-all.js";
import type { ReportAllStatus } from "./doctor/report-all-status.js";
import type { RunDoctor } from "./doctor/run-doctor.use-case.js";
import type { RunUserScopeDoctor } from "./doctor/run-user-scope-doctor.use-case.js";
import type { Output } from "./domain/output.js";
import type { AddMarketplace } from "./marketplace/add-marketplace.use-case.js";
import type { CheckMarketplaceUpstream } from "./marketplace/check-marketplace-upstream.use-case.js";
import type { ListMarketplaceCatalogs } from "./marketplace/list-marketplace-catalogs.use-case.js";
import type { RefreshMarketplaces } from "./marketplace/refresh-marketplaces.use-case.js";
import type { RemoveProjectMarketplace } from "./marketplace/remove-project-marketplace.use-case.js";
import type { RemoveUserMarketplace } from "./marketplace/remove-user-marketplace.use-case.js";
import type { InstallPlugin } from "./plugin/install-plugin.use-case.js";
import type { RemovePlugin } from "./plugin/remove-plugin.use-case.js";
import type { UpdateUserPlugin } from "./plugin/update-user-plugin.use-case.js";
import type { Prompter } from "./ports/prompter.js";
import type { InstallAiToolWithPlugins } from "./setup/install-ai-tool-with-plugins.use-case.js";
import type { RunSetup } from "./setup/run-setup.use-case.js";
import type { RunSync } from "./sync/run-sync.use-case.js";
import type { RunUserScopeSync } from "./sync/run-user-scope-sync.use-case.js";
import type { SyncNativeActivation } from "./sync/settings/sync-native-activation.use-case.js";
import type { SyncSettings } from "./sync/settings/sync-settings.use-case.js";
import type { UpdateTools } from "./sync/update-tools.use-case.js";
import type { ChooseIdentity } from "./telemetry/choose-identity.use-case.js";

export interface FactoryOptions {
  verbose: boolean;
  token?: string;
}

export interface TelemetryDeps {
  declareTask: Pick<DeclareTask, "execute">;
  readTelemetryStatus: Pick<ReadTelemetryStatus, "execute">;
  ingestUsage: Pick<IngestUsage, "execute">;
  requestReport: Pick<RequestReport, "execute">;
  manageIdentity: Pick<ManageIdentity, "execute">;
  proposeIdentity: Pick<ProposeIdentity, "execute">;
  chooseIdentity: Pick<ChooseIdentity, "execute">;
  readTranscriptRetention: Pick<ReadTranscriptRetention, "execute">;
  enableTelemetry: Pick<EnableTelemetry, "execute">;
  disableTelemetry: Pick<DisableTelemetry, "execute">;
  forgetTelemetry: Pick<ForgetTelemetry, "execute">;
}

/** Runs another `aidd` command in a child process and resolves with its exit code. */
export type CommandRunner = (command: string[]) => Promise<number>;

/** What a telemetry command's request alone can answer, built with no I/O so a refusal comes
 * before the dependencies are wired. */
export interface TelemetryRequests {
  parseTaskFlags: Pick<ParseTaskFlags, "execute">;
  parseReportFlags: Pick<ParseReportFlags, "execute">;
  checkTelemetryOn: Pick<CheckTelemetryOn, "execute">;
  checkFilterValue: Pick<CheckFilterValue, "execute">;
  parseIdentityFlags: Pick<ParseIdentityFlags, "execute">;
}

export interface Deps {
  /** The one home-directory resolver presentation calls, never `os.homedir()` directly, so a
   * test can point it elsewhere. */
  homedir: () => string;
  environment: Environment;
  logger: Logger;
  currentVersion: string;
  prompter: Prompter;
  logIn: Pick<LogIn, "execute">;
  logOut: Pick<LogOut, "execute">;
  checkStatus: Pick<CheckStatus, "execute">;
  pluginRemoveUseCase: Pick<RemovePlugin, "execute">;
  /** The user-scope removal, its home directory already bound. */
  userPluginRemove: {
    execute: (options: Omit<RemoveUserPluginRequest, "home" | "records">) => Promise<void>;
  };
  pluginListUseCase: Pick<ListPlugins, "execute">;
  pluginUpdateUseCase: Pick<UpdatePlugin, "execute">;
  userPluginUpdateUseCase: Pick<UpdateUserPlugin, "execute">;
  addMarketplace: Pick<AddMarketplace, "execute">;
  listMarketplaces: Pick<ListMarketplaces, "execute">;
  listMarketplaceCatalogs: Pick<ListMarketplaceCatalogs, "execute">;
  marketplaceRemoveUseCase: Pick<RemoveProjectMarketplace, "execute">;
  userMarketplaceRemoveUseCase: Pick<RemoveUserMarketplace, "execute">;
  refreshMarketplace: Pick<RefreshMarketplaces, "execute">;
  marketplaceCheckUseCase: Pick<CheckMarketplaceUpstream, "execute">;
  installAiToolUseCase: Pick<InstallAiToolWithPlugins, "execute">;
  installIdeToolUseCase: Pick<InstallIdeTool, "execute">;
  uninstallTools: Pick<UninstallProjectTools, "execute">;
  searchPlugins: Pick<SearchPlugins, "execute">;
  pluginInstallUseCase: Pick<InstallPlugin, "execute">;
  syncSettingsUseCase: Pick<SyncSettings, "execute">;
  syncNativeActivation: Pick<SyncNativeActivation, "execute">;
  doctorUseCase: Pick<RunDoctor, "execute">;
  runUserScopeDoctor: Pick<RunUserScopeDoctor, "execute">;
  runSetup: Pick<RunSetup, "execute">;
  /** The agents' provider and the main session's model: set by `setup`, forgotten by `clean`. */
  setAgentModels: Pick<SetAgentModels, "execute" | "reset">;
  selfUpdate: Pick<SelfUpdate, "execute">;
  statusUseCase: Pick<ReportStatus, "execute">;
  statusAllUseCase: { execute: ReportAllStatus };
  runSync: Pick<RunSync, "execute">;
  runUserScopeSync: Pick<RunUserScopeSync, "execute">;
  updateToolsUseCase: Pick<UpdateTools, "execute">;
  cleanUseCase: Pick<CleanProject, "execute">;
  cleanUserScopeUseCase: Pick<CleanUserScope, "execute">;
  doctorAllUseCase: { execute: DoctorAll };
  listInstalledRulesUseCase: Pick<ListInstalledRules, "execute">;
  validateRecipes: Pick<ValidateRecipes, "execute">;
  printUpdateNotice: Pick<PrintUpdateNotice, "execute">;
  refreshUpdateCheck: Pick<RefreshUpdateCheck, "execute">;
  telemetry: TelemetryDeps;
  /** The use case that builds a marketplace or a flat tree for a target, or undefined when the
   * target declares no build for the mode. */
  frameworkBuild: (ctx: FrameworkBuildContext) => Pick<BuildNativeTree, "execute"> | undefined;
}

/** Builds the graph a command runs on. `cli.ts` hands one to every command, so a command never
 * reaches the composition root itself. */
export type DepsFactory = (
  projectRoot: string,
  options: FactoryOptions,
  output: Output | undefined
) => Promise<Deps>;

/** A factory of the part of the graph a command reads. The real `DepsFactory` is assignable to
 * every one, and a test builds only the members its command touches. */
export type DepsSliceFactory<K extends keyof Deps> = (
  ...args: Parameters<DepsFactory>
) => Promise<Pick<Deps, K>>;
