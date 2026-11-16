import type { CheckStatus } from "../contexts/auth/application/check-status.js";
import type { LogIn } from "../contexts/auth/application/log-in.js";
import type { LogOut } from "../contexts/auth/application/log-out.js";
import type { AddMarketplace } from "../contexts/distribution/application/add-marketplace.js";
import type { ListMarketplaces } from "../contexts/distribution/application/list-marketplaces.js";
import type { SearchPlugins } from "../contexts/distribution/application/plugin-source/search-plugins.js";
import type { RefreshMarketplace } from "../contexts/distribution/application/refresh-marketplace.js";
import type { RegisterFrameworkMarketplace } from "../contexts/distribution/application/register-framework-marketplace.js";
import type { MarketplaceSyncSettingsUseCase } from "../contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import type { SetupMachineScopeUseCase } from "../contexts/framework/application/setup/setup-machine-scope-use-case.js";
import type { SetupMarketplaceRegistrationUseCase } from "../contexts/framework/application/shared/setup-marketplace-registration-use-case.js";
import type { DetectProjectContext } from "../contexts/installation/application/detect-project-context.js";
import type { InstallAiTool } from "../contexts/installation/application/install/install-ai-tool.js";
import type { InstallIdeTool } from "../contexts/installation/application/install/install-ide-tool.js";
import type { InstallTools } from "../contexts/installation/application/install/install-tools.js";
import type { ListInstalledRules } from "../contexts/installation/application/list-installed-rules.js";
import type { ListPlugins } from "../contexts/installation/application/plugin/list-plugins.js";
import type { UpdatePlugin } from "../contexts/installation/application/plugin/update-plugin.js";
import type { RemovePlugin } from "../contexts/installation/application/removal/remove-plugin.js";
import type { ReportStatus } from "../contexts/installation/application/report-status.js";
import type { Restore } from "../contexts/installation/application/restore/restore.js";
import type { UninstallTools } from "../contexts/installation/application/uninstall-tools.js";
import type { FileMerger } from "../contexts/installation/ports/file-merger.js";
import type { ManifestRepository } from "../contexts/installation/ports/manifest-repository.js";
import type { UserSourceReferences } from "../contexts/machine-claims/ports/user-source-references.js";
import type { ValidateRecipes } from "../contexts/recipes/application/validate-recipes.js";
import type { DeclareTask } from "../contexts/telemetry/application/declaration/declare-task.js";
import type { ResolveTaskRequest } from "../contexts/telemetry/application/declaration/resolve-task-request.js";
import type { ForgetTelemetry } from "../contexts/telemetry/application/forget/forget-telemetry.js";
import type { CheckIdentity } from "../contexts/telemetry/application/identity/check-identity.js";
import type { ManageIdentity } from "../contexts/telemetry/application/identity/manage-identity.js";
import type { ProposeIdentity } from "../contexts/telemetry/application/identity/propose-identity.js";
import type { IngestUsage } from "../contexts/telemetry/application/ingest-usage.js";
import type { ReadTelemetryStatus } from "../contexts/telemetry/application/read-telemetry-status.js";
import type { RequestReport } from "../contexts/telemetry/application/report/request-report.js";
import type { ResolveReportRequest } from "../contexts/telemetry/application/report/resolve-report-request.js";
import type { DisableTelemetry } from "../contexts/telemetry/application/switch/disable-telemetry.js";
import type { EnableTelemetry } from "../contexts/telemetry/application/switch/enable-telemetry.js";
import type { ReadTranscriptRetention } from "../contexts/telemetry/application/switch/read-transcript-retention.js";
import type { FrameworkBuildMode } from "../contexts/tools/contract/tool-profile.js";
import type { FrameworkBuildUseCase } from "../contexts/translate/application/translate-source.js";
import type { PrintUpdateNotice } from "../contexts/update/application/print-update-notice.js";
import type { RefreshUpdateCheck } from "../contexts/update/application/refresh-update-check.js";
import type { SelfUpdate } from "../contexts/update/application/self-update.js";
import type { CleanProject } from "../orchestration/clean/clean-project.js";
import type { CleanUserScope } from "../orchestration/clean/clean-user-scope.js";
import type { CheckRegistration } from "../orchestration/doctor/check-registration.js";
import type { RunDoctor } from "../orchestration/doctor/run-doctor.js";
import type { DoctorAll } from "../orchestration/global/doctor-all.js";
import type { ReportAllStatus } from "../orchestration/global/report-all-status.js";
import type { RestoreAll } from "../orchestration/global/restore-all.js";
import type { UpdateTools } from "../orchestration/global/update-tools.js";
import type { CheckMarketplaceUpstream } from "../orchestration/marketplace/check.js";
import type { RemoveProjectMarketplace } from "../orchestration/marketplace/remove.js";
import type { RemoveUserMarketplace } from "../orchestration/marketplace/remove-user.js";
import type { InstallPlugin } from "../orchestration/plugin/install-plugin.js";
import type { UpdateUserPlugin } from "../orchestration/plugin/update-user-plugin.js";
import type { AskMarketplaceSource } from "../orchestration/setup/ask-marketplace-source.js";
import type { AssetProvider } from "../shared/ports/asset-provider.js";
import type { Environment } from "../shared/ports/environment.js";
import type { FileReader } from "../shared/ports/file-reader.js";
import type { FileWriter } from "../shared/ports/file-writer.js";
import type { Lock } from "../shared/ports/lock.js";
import type { Logger } from "../shared/ports/logger.js";
import type { Prompter } from "../shared/ports/prompter.js";
import type { VersionReader } from "../shared/ports/version-reader.js";
import type { CLIOutput } from "./output.js";
import type { SetupPluginsPromptUseCase } from "./prompts/setup-plugins-prompt-use-case.js";
import type { SetupToolsPromptUseCase } from "./prompts/setup-tools-prompt-use-case.js";

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
  readTranscriptRetention: Pick<ReadTranscriptRetention, "execute">;
  enableTelemetry: Pick<EnableTelemetry, "execute">;
  disableTelemetry: Pick<DisableTelemetry, "execute">;
  forgetTelemetry: Pick<ForgetTelemetry, "execute">;
}

/** What a telemetry command's request alone can answer, built with no I/O so a refusal comes
 * before the dependencies are wired. */
export interface TelemetryRequests {
  resolveTaskRequest: Pick<ResolveTaskRequest, "execute">;
  resolveReportRequest: Pick<ResolveReportRequest, "execute">;
  checkIdentity: Pick<CheckIdentity, "execute">;
}

/** What a build for a target and mode asks of its caller. */
export interface FrameworkBuildContext {
  readonly target: string;
  readonly mode: FrameworkBuildMode;
  readonly outDir: string;
  readonly force: boolean;
}

export interface Deps {
  fs: FileReader & FileWriter & FileMerger;
  manifestRepo: ManifestRepository;
  /** `--scope user`'s own manifest repository: `userConfigDir()/manifest.json`, never nested
   * under a project's `.aidd/`. */
  userManifestRepo: ManifestRepository & Lock;
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
  pluginListUseCase: Pick<ListPlugins, "execute">;
  pluginUpdateUseCase: Pick<UpdatePlugin, "execute">;
  userPluginUpdateUseCase: Pick<UpdateUserPlugin, "execute">;
  addMarketplace: Pick<AddMarketplace, "execute">;
  listMarketplaces: Pick<ListMarketplaces, "execute">;
  marketplaceRemoveUseCase: Pick<RemoveProjectMarketplace, "execute">;
  userMarketplaceRemoveUseCase: Pick<RemoveUserMarketplace, "execute">;
  refreshMarketplace: Pick<RefreshMarketplace, "execute">;
  marketplaceCheckUseCase: Pick<CheckMarketplaceUpstream, "execute">;
  userSourceReferences: UserSourceReferences;
  installAiToolUseCase: Pick<InstallAiTool, "execute">;
  installIdeToolUseCase: Pick<InstallIdeTool, "execute">;
  uninstallTools: Pick<UninstallTools, "execute">;
  assetProvider: AssetProvider;
  searchPlugins: Pick<SearchPlugins, "execute">;
  registerFrameworkMarketplace: Pick<RegisterFrameworkMarketplace, "execute">;
  pluginInstallUseCase: Pick<InstallPlugin, "execute">;
  marketplaceSyncSettingsUseCase: Pick<MarketplaceSyncSettingsUseCase, "execute">;
  doctorUseCase: Pick<RunDoctor, "execute">;
  /** The registration check alone, reused directly by `doctor --scope user`. */
  doctorRegistrationUseCase: Pick<CheckRegistration, "execute">;
  askMarketplaceSource: Pick<AskMarketplaceSource, "execute">;
  setupToolsUseCase: Pick<InstallTools, "execute">;
  setupPluginsPromptUseCase: Pick<SetupPluginsPromptUseCase, "execute">;
  setupToolsPromptUseCase: Pick<SetupToolsPromptUseCase, "execute">;
  projectContextDetector: Pick<DetectProjectContext, "execute">;
  setupMarketplaceRegistration: Pick<
    SetupMarketplaceRegistrationUseCase,
    "resolveSourceIfNeeded" | "registerIfPresent"
  >;
  setupMachineScopeUseCase: Pick<SetupMachineScopeUseCase, "execute">;
  selfUpdate: Pick<SelfUpdate, "execute">;
  statusUseCase: Pick<ReportStatus, "execute">;
  restoreUseCase: Pick<Restore, "execute">;
  statusAllUseCase: Pick<ReportAllStatus, "execute">;
  restoreAllUseCase: Pick<RestoreAll, "execute">;
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
  frameworkBuild: (
    ctx: FrameworkBuildContext
  ) => Pick<FrameworkBuildUseCase, "execute"> | undefined;
}

/** What the menu and the interactive prompts of a command group need, before any graph exists. */
export interface MenuDeps {
  manifestRepo: ManifestRepository;
  prompter: Prompter;
}

/** Builds the graph a command runs on. `cli.ts` hands one to every command, so a command never
 * reaches the composition root itself. */
export type DepsFactory = (
  projectRoot: string,
  options: FactoryOptions,
  output: CLIOutput | undefined
) => Promise<Deps>;

export type MenuDepsFactory = (projectRoot: string) => MenuDeps;

/** A factory of the part of the graph a command reads. The real `DepsFactory` is assignable to
 * every one, and a test builds only the members its command touches. */
export type DepsSliceFactory<K extends keyof Deps> = (
  ...args: Parameters<DepsFactory>
) => Promise<Pick<Deps, K>>;

/** The menu counterpart of {@link DepsSliceFactory}. */
export type MenuDepsSliceFactory<K extends keyof MenuDeps> = (
  projectRoot: string
) => Pick<MenuDeps, K>;
