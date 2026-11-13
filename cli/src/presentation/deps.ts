import type { CheckStatus } from "../contexts/auth/application/check-status.js";
import type { LogIn } from "../contexts/auth/application/log-in.js";
import type { LogOut } from "../contexts/auth/application/log-out.js";
import type { AddMarketplace } from "../contexts/distribution/application/add-marketplace.js";
import type { ListMarketplaces } from "../contexts/distribution/application/list-marketplaces.js";
import type { RefreshMarketplace } from "../contexts/distribution/application/refresh-marketplace.js";
import type { RegisterFrameworkMarketplace } from "../contexts/distribution/application/register-framework-marketplace.js";
import type { ReleaseLister } from "../contexts/distribution/ports/release-lister.js";
import type { RepositoryVisibility } from "../contexts/distribution/ports/repository-visibility.js";
import type { CleanUserScopeUseCase } from "../contexts/framework/application/clean/clean-user-scope-use-case.js";
import type { CleanUseCase } from "../contexts/framework/application/clean-use-case.js";
import type { DoctorRegistrationUseCase } from "../contexts/framework/application/doctor/doctor-registration-use-case.js";
import type { DoctorUseCase } from "../contexts/framework/application/doctor/doctor-use-case.js";
import type { MarketplaceCheckUseCase } from "../contexts/framework/application/flows/marketplace-check-use-case.js";
import type { MarketplaceRemoveUseCase } from "../contexts/framework/application/flows/marketplace-remove-use-case.js";
import type { MarketplaceSyncSettingsUseCase } from "../contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import type { DoctorAllUseCase } from "../contexts/framework/application/global/doctor-all-use-case.js";
import type { RestoreAllUseCase } from "../contexts/framework/application/global/restore-all-use-case.js";
import type { StatusAllUseCase } from "../contexts/framework/application/global/status-all-use-case.js";
import type { UpdateAiToolsUseCase } from "../contexts/framework/application/global/update-ai-tools-use-case.js";
import type { UpdateIdeToolsUseCase } from "../contexts/framework/application/global/update-ide-tools-use-case.js";
import type { InstallAiToolUseCase } from "../contexts/framework/application/install/install-ai-tool-use-case.js";
import type { InstallIdeToolUseCase } from "../contexts/framework/application/install/install-ide-tool-use-case.js";
import type { ListInstalledRulesUseCase } from "../contexts/framework/application/list-installed-rules-use-case.js";
import type { UserMarketplaceRemoveUseCase } from "../contexts/framework/application/ownership/user-marketplace-remove-use-case.js";
import type { UserPluginUpdateUseCase } from "../contexts/framework/application/ownership/user-plugin-update-use-case.js";
import type { PluginInstallUseCase } from "../contexts/framework/application/plugin/plugin-install-use-case.js";
import type { PluginListUseCase } from "../contexts/framework/application/plugin/plugin-list-use-case.js";
import type { PluginRemoveUseCase } from "../contexts/framework/application/plugin/plugin-remove-use-case.js";
import type { PluginSearchUseCase } from "../contexts/framework/application/plugin/plugin-search-use-case.js";
import type { PluginUpdateUseCase } from "../contexts/framework/application/plugin/plugin-update-use-case.js";
import type { RestoreUseCase } from "../contexts/framework/application/restore/restore-use-case.js";
import type { ProjectContextDetectorUseCase } from "../contexts/framework/application/setup/project-context-detector-use-case.js";
import type { SetupMachineScopeUseCase } from "../contexts/framework/application/setup/setup-machine-scope-use-case.js";
import type { SetupMarketplaceSourceUseCase } from "../contexts/framework/application/setup/setup-marketplace-source-use-case.js";
import type { SetupToolsUseCase } from "../contexts/framework/application/setup/setup-tools-use-case.js";
import type { SetupMarketplaceRegistrationUseCase } from "../contexts/framework/application/shared/setup-marketplace-registration-use-case.js";
import type { StatusUseCase } from "../contexts/framework/application/status-use-case.js";
import type { UninstallIdeUseCase } from "../contexts/framework/application/uninstall/uninstall-ide-use-case.js";
import type { UninstallUseCase } from "../contexts/framework/application/uninstall/uninstall-use-case.js";
import type { ManifestRepository } from "../contexts/framework/domain/ports/manifest-repository.js";
import type { UserSourceReferences } from "../contexts/framework/domain/ports/user-source-references.js";
import type { ValidateRecipes } from "../contexts/recipes/application/validate-recipes.js";
import type { DeclareTaskUseCase } from "../contexts/telemetry/application/declare-task-use-case.js";
import type { ForgetTelemetryUseCase } from "../contexts/telemetry/application/forget/forget-telemetry-use-case.js";
import type { ManageIdentityUseCase } from "../contexts/telemetry/application/identity/manage-identity-use-case.js";
import type { ProposeIdentityUseCase } from "../contexts/telemetry/application/identity/propose-identity-use-case.js";
import type { IngestUsageUseCase } from "../contexts/telemetry/application/ingest-usage-use-case.js";
import type { ReportUsageUseCase } from "../contexts/telemetry/application/report/report-usage-use-case.js";
import type { SnapshotBindingsUseCase } from "../contexts/telemetry/application/snapshot-bindings-use-case.js";
import type { TelemetryOffUseCase } from "../contexts/telemetry/application/switch/telemetry-off-use-case.js";
import type { TelemetryOnUseCase } from "../contexts/telemetry/application/switch/telemetry-on-use-case.js";
import type { TelemetryStatusUseCase } from "../contexts/telemetry/application/telemetry-status-use-case.js";
import type { FrameworkBuildMode } from "../contexts/tools/contract/tool-profile.js";
import type { FrameworkBuildUseCase } from "../contexts/translate/application/translate-source.js";
import type { PrintUpdateNotice } from "../contexts/update/application/print-update-notice.js";
import type { RefreshUpdateCheck } from "../contexts/update/application/refresh-update-check.js";
import type { SelfUpdate } from "../contexts/update/application/self-update.js";
import type { AssetProvider } from "../kernel/ports/asset-provider.js";
import type { FileReader } from "../kernel/ports/file-reader.js";
import type { FileWriter } from "../kernel/ports/file-writer.js";
import type { Logger } from "../kernel/ports/logger.js";
import type { Prompter } from "../kernel/ports/prompter.js";
import type { VersionReader } from "../kernel/ports/version-reader.js";
import type { Environment } from "../shared/ports/environment.js";
import type { FileMerger } from "../shared/ports/file-merger.js";
import type { CLIOutput } from "./output.js";
import type { SetupPluginsPromptUseCase } from "./prompts/setup-plugins-prompt-use-case.js";
import type { SetupToolsPromptUseCase } from "./prompts/setup-tools-prompt-use-case.js";

export interface GlobalOptions {
  verbose: boolean;
  token?: string;
}

export interface TelemetryDeps {
  declareTaskUseCase: DeclareTaskUseCase;
  telemetryStatusUseCase: TelemetryStatusUseCase;
  ingestUsageUseCase: IngestUsageUseCase;
  snapshotBindingsUseCase: SnapshotBindingsUseCase;
  reportUsageUseCase: ReportUsageUseCase;
  manageIdentityUseCase: ManageIdentityUseCase;
  proposeIdentityUseCase: ProposeIdentityUseCase;
  telemetryOnUseCase: TelemetryOnUseCase;
  telemetryOffUseCase: TelemetryOffUseCase;
  forgetTelemetryUseCase: ForgetTelemetryUseCase;
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
  userManifestRepo: ManifestRepository;
  /** The one home-directory resolver presentation calls, never `os.homedir()` directly, so a
   * test can point it elsewhere. */
  homedir: () => string;
  environment: Environment;
  logger: Logger;
  currentVersionProvider: VersionReader;
  prompter: Prompter;
  logIn: LogIn;
  logOut: LogOut;
  checkStatus: CheckStatus;
  pluginRemoveUseCase: PluginRemoveUseCase;
  pluginListUseCase: PluginListUseCase;
  pluginUpdateUseCase: PluginUpdateUseCase;
  userPluginUpdateUseCase: UserPluginUpdateUseCase;
  marketplaceAddUseCase: AddMarketplace;
  marketplaceListUseCase: ListMarketplaces;
  marketplaceRemoveUseCase: MarketplaceRemoveUseCase;
  userMarketplaceRemoveUseCase: UserMarketplaceRemoveUseCase;
  marketplaceRefreshUseCase: RefreshMarketplace;
  marketplaceCheckUseCase: MarketplaceCheckUseCase;
  userSourceReferences: UserSourceReferences;
  installAiToolUseCase: InstallAiToolUseCase;
  installIdeToolUseCase: InstallIdeToolUseCase;
  uninstallIdeUseCase: UninstallIdeUseCase;
  assetProvider: AssetProvider;
  pluginSearchUseCase: PluginSearchUseCase;
  marketplaceRegisterFrameworkUseCase: RegisterFrameworkMarketplace;
  pluginInstallUseCase: PluginInstallUseCase;
  marketplaceSyncSettingsUseCase: MarketplaceSyncSettingsUseCase;
  doctorUseCase: DoctorUseCase;
  /** The registration check alone, reused directly by `doctor --scope user`. */
  doctorRegistrationUseCase: DoctorRegistrationUseCase;
  releaseResolver: ReleaseLister & RepositoryVisibility;
  setupMarketplaceSourceUseCase: SetupMarketplaceSourceUseCase;
  setupToolsUseCase: SetupToolsUseCase;
  setupPluginsPromptUseCase: SetupPluginsPromptUseCase;
  setupToolsPromptUseCase: SetupToolsPromptUseCase;
  projectContextDetector: ProjectContextDetectorUseCase;
  setupMarketplaceRegistration: SetupMarketplaceRegistrationUseCase;
  setupMachineScopeUseCase: SetupMachineScopeUseCase;
  selfUpdate: SelfUpdate;
  statusUseCase: StatusUseCase;
  restoreUseCase: RestoreUseCase;
  uninstallUseCase: UninstallUseCase;
  statusAllUseCase: StatusAllUseCase;
  restoreAllUseCase: RestoreAllUseCase;
  updateAiToolsUseCase: UpdateAiToolsUseCase;
  updateIdeToolsUseCase: UpdateIdeToolsUseCase;
  cleanUseCase: CleanUseCase;
  cleanUserScopeUseCase: CleanUserScopeUseCase;
  doctorAllUseCase: DoctorAllUseCase;
  listInstalledRulesUseCase: ListInstalledRulesUseCase;
  validateRecipes: ValidateRecipes;
  printUpdateNotice: PrintUpdateNotice;
  refreshUpdateCheck: RefreshUpdateCheck;
  telemetry: TelemetryDeps;
  /** The use case that builds a marketplace or a flat tree for a target, or undefined when the
   * target declares no build for the mode. */
  frameworkBuild: (ctx: FrameworkBuildContext) => FrameworkBuildUseCase | undefined;
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
  options: GlobalOptions,
  output: CLIOutput | undefined
) => Promise<Deps>;

export type MenuDepsFactory = (projectRoot: string) => MenuDeps;
