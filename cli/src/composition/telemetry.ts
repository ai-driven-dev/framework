import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { ConsentedRepositories } from "../contexts/telemetry/application/consented-repositories.js";
import { DeclareOnBranch } from "../contexts/telemetry/application/declaration/declare-on-branch.js";
import { DeclareTask } from "../contexts/telemetry/application/declaration/declare-task.js";
import { ReadCurrentBranch } from "../contexts/telemetry/application/declaration/read-current-branch.js";
import { ResolveTaskRequest } from "../contexts/telemetry/application/declaration/resolve-task-request.js";
import { DirectoryResolver } from "../contexts/telemetry/application/directory-resolver.js";
import { ForgetTelemetry } from "../contexts/telemetry/application/forget/forget-telemetry.js";
import { RememberedClones } from "../contexts/telemetry/application/forget/remembered-clones.js";
import { CheckIdentity } from "../contexts/telemetry/application/identity/check-identity.js";
import { ChooseIdentity } from "../contexts/telemetry/application/identity/choose-identity.js";
import { ManageIdentity } from "../contexts/telemetry/application/identity/manage-identity.js";
import { ProposeIdentity } from "../contexts/telemetry/application/identity/propose-identity.js";
import { IngestUsage } from "../contexts/telemetry/application/ingest-usage.js";
import { ReadTelemetryStatus } from "../contexts/telemetry/application/read-telemetry-status.js";
import { ReadUsage } from "../contexts/telemetry/application/read-usage.js";
import { CheckFilterValue } from "../contexts/telemetry/application/report/check-filter-value.js";
import { DeclaredBindings } from "../contexts/telemetry/application/report/declared-bindings.js";
import { ReportUsage } from "../contexts/telemetry/application/report/report-usage.js";
import { RequestReport } from "../contexts/telemetry/application/report/request-report.js";
import { ResolveReportRequest } from "../contexts/telemetry/application/report/resolve-report-request.js";
import { SnapshotBindings } from "../contexts/telemetry/application/snapshot-bindings.js";
import { CheckOnRequest } from "../contexts/telemetry/application/switch/check-on-request.js";
import { DisableTelemetry } from "../contexts/telemetry/application/switch/disable-telemetry.js";
import { EnableTelemetry } from "../contexts/telemetry/application/switch/enable-telemetry.js";
import { GrantConsent } from "../contexts/telemetry/application/switch/grant-consent.js";
import { ReadTranscriptRetention } from "../contexts/telemetry/application/switch/read-transcript-retention.js";
import { RememberOwnRoot } from "../contexts/telemetry/application/switch/remember-own-root.js";
import { WithdrawConsent } from "../contexts/telemetry/application/switch/withdraw-consent.js";
import { environmentWithoutGitVariables } from "../contexts/telemetry/domain/git-environment.js";
import { legacyLocations } from "../contexts/telemetry/domain/legacy/legacy-locations.js";
import { GitBranchBindingSourceAdapter } from "../contexts/telemetry/infrastructure/git/git-branch-binding-source-adapter.js";
import { GitBranchBindingStoreAdapter } from "../contexts/telemetry/infrastructure/git/git-branch-binding-store-adapter.js";
import { GitConsentAdapter } from "../contexts/telemetry/infrastructure/git/git-consent-adapter.js";
import { GitRepositoryLocatorAdapter } from "../contexts/telemetry/infrastructure/git/git-repository-locator-adapter.js";
import { GitUserSourceAdapter } from "../contexts/telemetry/infrastructure/git/git-user-source-adapter.js";
import { RepositoryAliasStoreAdapter } from "../contexts/telemetry/infrastructure/legacy/repository-alias-store-adapter.js";
import { ClaudeSettingsAdapter } from "../contexts/telemetry/infrastructure/sources/claude/claude-settings-adapter.js";
import { ClaudeTranscriptSourceAdapter } from "../contexts/telemetry/infrastructure/sources/claude/claude-transcript-source-adapter.js";
import { CodexTranscriptSourceAdapter } from "../contexts/telemetry/infrastructure/sources/codex/codex-transcript-source-adapter.js";
import { ConsentHistoryAdapter } from "../contexts/telemetry/infrastructure/storage/consent/consent-history-adapter.js";
import { BindingsLockAdapter } from "../contexts/telemetry/infrastructure/storage/declarations/bindings-lock-adapter.js";
import { RepositoryDeclarationsAdapter } from "../contexts/telemetry/infrastructure/storage/declarations/repository-declarations-adapter.js";
import { SessionBindingStoreAdapter } from "../contexts/telemetry/infrastructure/storage/declarations/session-binding-store-adapter.js";
import { BindingSnapshotStoreAdapter } from "../contexts/telemetry/infrastructure/storage/ledger/binding-snapshot-store-adapter.js";
import { ResolutionStoreAdapter } from "../contexts/telemetry/infrastructure/storage/ledger/resolution-store-adapter.js";
import { UsageLedgerAdapter } from "../contexts/telemetry/infrastructure/storage/ledger/usage-ledger-adapter.js";
import { MeasurementErasureAdapter } from "../contexts/telemetry/infrastructure/storage/measurement-erasure-adapter.js";
import { PersonIdentityAdapter } from "../contexts/telemetry/infrastructure/storage/person-identity-adapter.js";
import { PrivateStorageAdapter } from "../contexts/telemetry/infrastructure/storage/private-storage-adapter.js";
import type { UsageSource } from "../contexts/telemetry/ports/usage-source.js";
import type { TelemetryDeps, TelemetryRequests } from "../presentation/deps.js";
import { EnvironmentAdapter } from "../shared/infrastructure/environment-adapter.js";
import { userConfigDirOf } from "../shared/infrastructure/user-config-dir.js";
import type { Prompter } from "../shared/ports/prompter.js";

/** The requests a command checks before anything is wired: no file, no process, only the clock. */
export function wireTelemetryRequests(): TelemetryRequests {
  return {
    resolveTaskRequest: new ResolveTaskRequest(),
    resolveReportRequest: new ResolveReportRequest(() => new Date()),
    checkOnRequest: new CheckOnRequest(new CheckIdentity()),
    checkFilterValue: new CheckFilterValue(),
  };
}

/** Where a person's measurement lives. `AIDD_TELEMETRY_DIR` moves it outright; otherwise it is
 * a subdirectory of the user configuration, apart from the files that live at its root. */
export function telemetryDirOf(
  env: NodeJS.ProcessEnv,
  home: string,
  joinPath: (...parts: string[]) => string = join
): string {
  const chosen = env.AIDD_TELEMETRY_DIR;
  return chosen !== undefined && chosen !== ""
    ? chosen
    : joinPath(userConfigDirOf(env, home, joinPath), "telemetry");
}

export function telemetryDir(): string {
  return telemetryDirOf(process.env, homedir());
}

/** The directory holding Claude Code's own configuration. `configDir` is `CLAUDE_CONFIG_DIR`. */
export function claudeConfigDir(configDir: string | undefined, home: string): string {
  return configDir === undefined || configDir === "" ? join(home, ".claude") : configDir;
}

/** The directory holding every Claude Code transcript. */
export function claudeProjectsRoot(configDir: string | undefined, home: string): string {
  return join(claudeConfigDir(configDir, home), "projects");
}

/** Where Codex keeps its session files. `codexHome` is `CODEX_HOME`. Archiving moves a file
 * from the first to the second. */
export function codexSessionRoots(codexHome: string | undefined, home: string): string[] {
  const dir = codexHome === undefined || codexHome === "" ? join(home, ".codex") : codexHome;
  return [join(dir, "sessions"), join(dir, "archived_sessions")];
}

/** The session a declaration binds: the one a hook names (Codex sets no session variable), else
 * Claude Code's. An empty variable is no session. */
export function declaringSessionOf(env: NodeJS.ProcessEnv): string | null {
  return env.AIDD_TELEMETRY_SESSION_ID || env.CLAUDE_CODE_SESSION_ID || null;
}

/** macOS and Windows file systems answer one directory to several spellings. */
export function caseInsensitiveFileSystem(platform: NodeJS.Platform): boolean {
  return platform === "darwin" || platform === "win32";
}

export function wireTelemetry(homedir: () => string, prompter: Prompter): TelemetryDeps {
  const root = telemetryDir();
  const ledgerDir = join(root, "ledger");
  const storage = new PrivateStorageAdapter();
  const gitEnv = environmentWithoutGitVariables(process.env);
  const bindingsDir = join(root, "bindings");
  const branchSource = new GitBranchBindingSourceAdapter(gitEnv);
  const aliases = new RepositoryAliasStoreAdapter(ledgerDir);
  const snapshotStore = new BindingSnapshotStoreAdapter(bindingsDir, storage, aliases);
  const bindingsLock = new BindingsLockAdapter(bindingsDir, storage);
  const snapshotBindings = new SnapshotBindings(
    branchSource,
    snapshotStore,
    bindingsLock,
    () => new Date()
  );
  const ledger = new UsageLedgerAdapter(ledgerDir, storage);
  const locator = new GitRepositoryLocatorAdapter(gitEnv);
  const consents = new GitConsentAdapter(gitEnv);
  const resolutionStore = new ResolutionStoreAdapter(ledgerDir, storage);
  const consentHistory = new ConsentHistoryAdapter(ledgerDir, storage);
  const environment = {
    caseInsensitiveFileSystem: caseInsensitiveFileSystem(process.platform),
    now: () => new Date(),
  };
  const sessions = new SessionBindingStoreAdapter(bindingsDir, storage);
  const sessionId = declaringSessionOf(process.env);
  const processEnvironment = new EnvironmentAdapter();
  const repositories = new ConsentedRepositories(locator, consents, consentHistory);
  const branchStore = new GitBranchBindingStoreAdapter(gitEnv);
  const declareOnBranch = new DeclareOnBranch(branchStore, snapshotBindings);
  const readCurrentBranch = new ReadCurrentBranch(branchStore, branchSource);
  const declaration = { environment: processEnvironment, sessionId, now: () => new Date() };
  const declareTask = new DeclareTask(
    repositories,
    sessions,
    declareOnBranch,
    bindingsLock,
    declaration
  );
  const identity = new PersonIdentityAdapter(root, storage);
  const readTelemetryStatus = new ReadTelemetryStatus(
    repositories,
    sessions,
    readCurrentBranch,
    declaration,
    identity
  );
  // The measured tools, registered once: a tool is one source here and nowhere else.
  const usageSources: readonly UsageSource[] = [
    new ClaudeTranscriptSourceAdapter(claudeProjectsRoot(process.env.CLAUDE_CONFIG_DIR, homedir())),
    new CodexTranscriptSourceAdapter({
      roots: codexSessionRoots(process.env.CODEX_HOME, homedir()),
      tool: "codex",
    }),
  ];
  const ingestUsage = new IngestUsage(
    usageSources.map((source) => new ReadUsage(source)),
    ledger,
    new DirectoryResolver(locator, consents, resolutionStore, consentHistory, environment),
    snapshotBindings,
    { environment: processEnvironment }
  );
  const manageIdentity = new ManageIdentity(identity);
  const proposeIdentity = new ProposeIdentity(new GitUserSourceAdapter(gitEnv), processEnvironment);
  const claudeDir = claudeConfigDir(process.env.CLAUDE_CONFIG_DIR, homedir());
  return {
    declareTask,
    readTelemetryStatus,
    ingestUsage,
    requestReport: new RequestReport(
      new ReportUsage(
        ingestUsage,
        ledger,
        new DeclaredBindings(sessions, snapshotStore, identity),
        locator,
        processEnvironment
      )
    ),
    manageIdentity,
    proposeIdentity,
    chooseIdentity: new ChooseIdentity(
      manageIdentity,
      proposeIdentity,
      new CheckIdentity(),
      prompter
    ),
    readTranscriptRetention: new ReadTranscriptRetention(
      new ClaudeSettingsAdapter(claudeDir, ".claude")
    ),
    enableTelemetry: new EnableTelemetry(
      locator,
      consents,
      new GrantConsent(consents, consents, consentHistory, ledger, () => ({
        token: randomUUID(),
        at: environment.now(),
      })),
      new RememberOwnRoot(ledger, resolutionStore, environment),
      identity
    ),
    disableTelemetry: new DisableTelemetry(
      locator,
      consents,
      new WithdrawConsent(consents, consentHistory, ledger, environment.now)
    ),
    forgetTelemetry: new ForgetTelemetry(
      new MeasurementErasureAdapter(
        root,
        legacyLocations(process.env, homedir(), process.platform, root)
      ),
      new RepositoryDeclarationsAdapter(gitEnv),
      new RememberedClones(resolutionStore, consentHistory, snapshotStore),
      ledger
    ),
  };
}
