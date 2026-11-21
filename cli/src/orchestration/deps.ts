import type { CheckStatus } from "../contexts/auth/application/check-status.js";
import type { LogIn } from "../contexts/auth/application/log-in.js";
import type { LogOut } from "../contexts/auth/application/log-out.js";
import type { ListMarketplaces } from "../contexts/distribution/application/list-marketplaces.js";
import type { SearchPlugins } from "../contexts/distribution/application/plugin-source/search-plugins.js";
import type { RefreshMarketplace } from "../contexts/distribution/application/refresh-marketplace.js";
import type { InstallAiTool } from "../contexts/installation/application/install/install-ai-tool.js";
import type { InstallIdeTool } from "../contexts/installation/application/install/install-ide-tool.js";
import type { ListInstalledRules } from "../contexts/installation/application/list-installed-rules.js";
import type { ListPlugins } from "../contexts/installation/application/plugin/list-plugins.js";
import type { UpdatePlugin } from "../contexts/installation/application/plugin/update-plugin.js";
import type { RemovePlugin } from "../contexts/installation/application/removal/remove-plugin.js";
import type { UserPluginRemoveOptions } from "../contexts/installation/application/removal/remove-user-plugin.js";
import type { ReportStatus } from "../contexts/installation/application/report-status.js";
import type { UninstallTools } from "../contexts/installation/application/uninstall-tools.js";
import type { ValidateRecipes } from "../contexts/recipes/application/validate-recipes.js";
import type { DeclareTask } from "../contexts/telemetry/application/declaration/declare-task.js";
import type { ResolveTaskRequest } from "../contexts/telemetry/application/declaration/resolve-task-request.js";
import type { ForgetTelemetry } from "../contexts/telemetry/application/forget/forget-telemetry.js";
import type { ChooseIdentity } from "../contexts/telemetry/application/identity/choose-identity.js";
import type { ManageIdentity } from "../contexts/telemetry/application/identity/manage-identity.js";
import type { ProposeIdentity } from "../contexts/telemetry/application/identity/propose-identity.js";
import type { ResolveIdentityRequest } from "../contexts/telemetry/application/identity/resolve-identity-request.js";
import type { IngestUsage } from "../contexts/telemetry/application/ingest-usage.js";
import type { ReadTelemetryStatus } from "../contexts/telemetry/application/read-telemetry-status.js";
import type { CheckFilterValue } from "../contexts/telemetry/application/report/check-filter-value.js";
import type { RequestReport } from "../contexts/telemetry/application/report/request-report.js";
import type { ResolveReportRequest } from "../contexts/telemetry/application/report/resolve-report-request.js";
import type { CheckOnRequest } from "../contexts/telemetry/application/switch/check-on-request.js";
import type { DisableTelemetry } from "../contexts/telemetry/application/switch/disable-telemetry.js";
import type { EnableTelemetry } from "../contexts/telemetry/application/switch/enable-telemetry.js";
import type { ReadTranscriptRetention } from "../contexts/telemetry/application/switch/read-transcript-retention.js";
import type {
  BuildNativeTree,
  FrameworkBuildContext,
} from "../contexts/translate/application/build-native-tree.js";
import type { PrintUpdateNotice } from "../contexts/update/application/print-update-notice.js";
import type { RefreshUpdateCheck } from "../contexts/update/application/refresh-update-check.js";
import type { SelfUpdate } from "../contexts/update/application/self-update.js";
import type { Environment } from "../shared/ports/environment.js";
import type { Logger } from "../shared/ports/logger.js";
import type { Prompter } from "../shared/ports/prompter.js";
import type { VersionReader } from "../shared/ports/version-reader.js";
import type { SetAgentModels } from "./agent-models/set-agent-models.js";
import type { CleanProject } from "./clean/clean-project.js";
import type { CleanUserScope } from "./clean/clean-user-scope.js";
import type { RunDoctor } from "./doctor/run-doctor.js";
import type { RunUserScopeDoctor } from "./doctor/run-user-scope-doctor.js";
import type { Output } from "./domain/output.js";
import type { DoctorAll } from "./global/doctor-all.js";
import type { ReportAllStatus } from "./global/report-all-status.js";
import type { UpdateTools } from "./global/update-tools.js";
import type { AddMarketplace } from "./marketplace/add-marketplace.js";
import type { CheckMarketplaceUpstream } from "./marketplace/check-marketplace-upstream.js";
import type { RemoveProjectMarketplace } from "./marketplace/remove-project-marketplace.js";
import type { RemoveUserMarketplace } from "./marketplace/remove-user-marketplace.js";
import type { InstallPlugin } from "./plugin/install-plugin.js";
import type { UpdateUserPlugin } from "./plugin/update-user-plugin.js";
import type { RunSetup } from "./setup/run-setup.js";
import type { RunSync } from "./sync/run-sync.js";
import type { RunUserScopeSync } from "./sync/run-user-scope-sync.js";
import type { SyncNativeActivation } from "./sync/sync-native-activation.js";
import type { SyncSettings } from "./sync/sync-settings.js";

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
  resolveTaskRequest: Pick<ResolveTaskRequest, "execute">;
  resolveReportRequest: Pick<ResolveReportRequest, "execute">;
  checkOnRequest: Pick<CheckOnRequest, "execute">;
  checkFilterValue: Pick<CheckFilterValue, "execute">;
  resolveIdentityRequest: Pick<ResolveIdentityRequest, "execute">;
}

export interface Deps {
  /** The one home-directory resolver presentation calls, never `os.homedir()` directly, so a
   * test can point it elsewhere. */
  homedir: () => string;
  environment: Environment;
  logger: Logger;
  currentVersionProvider: VersionReader;
  prompter: Prompter;
  logIn: Pick<LogIn, "execute">;
  logOut: Pick<LogOut, "execute">;
  checkStatus: Pick<CheckStatus, "execute">;
  pluginRemoveUseCase: Pick<RemovePlugin, "execute">;
  /** The user-scope removal, its home directory already bound. */
  userPluginRemove: { execute: (options: Omit<UserPluginRemoveOptions, "home">) => Promise<void> };
  pluginListUseCase: Pick<ListPlugins, "execute">;
  pluginUpdateUseCase: Pick<UpdatePlugin, "execute">;
  userPluginUpdateUseCase: Pick<UpdateUserPlugin, "execute">;
  addMarketplace: Pick<AddMarketplace, "execute">;
  listMarketplaces: Pick<ListMarketplaces, "execute">;
  marketplaceRemoveUseCase: Pick<RemoveProjectMarketplace, "execute">;
  userMarketplaceRemoveUseCase: Pick<RemoveUserMarketplace, "execute">;
  refreshMarketplace: Pick<RefreshMarketplace, "execute">;
  marketplaceCheckUseCase: Pick<CheckMarketplaceUpstream, "execute">;
  installAiToolUseCase: Pick<InstallAiTool, "execute">;
  installIdeToolUseCase: Pick<InstallIdeTool, "execute">;
  uninstallTools: Pick<UninstallTools, "execute">;
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
  statusAllUseCase: Pick<ReportAllStatus, "execute">;
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
