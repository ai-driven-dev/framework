import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { LoadConsentLog } from "../contexts/telemetry/application/consent/load-consent-log.use-case.js";
import { RecordConsentEvent } from "../contexts/telemetry/application/consent/record-consent-event.use-case.js";
import { DeclareOnBranch } from "../contexts/telemetry/application/declaration/declare-on-branch.use-case.js";
import { DeclareTask } from "../contexts/telemetry/application/declaration/declare-task.use-case.js";
import { ParseTaskFlags } from "../contexts/telemetry/application/declaration/parse-task-flags.use-case.js";
import { ReadCurrentBranch } from "../contexts/telemetry/application/declaration/read-current-branch.use-case.js";
import { DirectoryResolver } from "../contexts/telemetry/application/directory-resolver.use-case.js";
import { FindConsentedRepository } from "../contexts/telemetry/application/find-consented-repository.use-case.js";
import { ForgetTelemetry } from "../contexts/telemetry/application/forget/forget-telemetry.use-case.js";
import { ReadRememberedClones } from "../contexts/telemetry/application/forget/read-remembered-clones.use-case.js";
import { CheckIdentity } from "../contexts/telemetry/application/identity/check-identity.use-case.js";
import { DecideIdentity } from "../contexts/telemetry/application/identity/decide-identity.use-case.js";
import { ManageIdentity } from "../contexts/telemetry/application/identity/manage-identity.use-case.js";
import { ParseIdentityFlags } from "../contexts/telemetry/application/identity/parse-identity-flags.use-case.js";
import { ProposeIdentity } from "../contexts/telemetry/application/identity/propose-identity.use-case.js";
import { IngestUsage } from "../contexts/telemetry/application/ingest-usage.use-case.js";
import { ReadTelemetryStatus } from "../contexts/telemetry/application/read-telemetry-status.use-case.js";
import { ReadUsage } from "../contexts/telemetry/application/read-usage.use-case.js";
import { CheckFilterValue } from "../contexts/telemetry/application/report/check-filter-value.use-case.js";
import { ParseReportFlags } from "../contexts/telemetry/application/report/parse-report-flags.use-case.js";
import { ReadDeclaredBindings } from "../contexts/telemetry/application/report/read-declared-bindings.use-case.js";
import { ReportUsage } from "../contexts/telemetry/application/report/report-usage.use-case.js";
import { RequestReport } from "../contexts/telemetry/application/report/request-report.use-case.js";
import { SnapshotBindings } from "../contexts/telemetry/application/snapshot-bindings.use-case.js";
import { CheckTelemetryOn } from "../contexts/telemetry/application/switch/check-telemetry-on.use-case.js";
import { DisableTelemetry } from "../contexts/telemetry/application/switch/disable-telemetry.use-case.js";
import { EnableTelemetry } from "../contexts/telemetry/application/switch/enable-telemetry.use-case.js";
import { GrantConsent } from "../contexts/telemetry/application/switch/grant-consent.use-case.js";
import { ReadCloneConsent } from "../contexts/telemetry/application/switch/read-clone-consent.use-case.js";
import { ReadTranscriptRetention } from "../contexts/telemetry/application/switch/read-transcript-retention.use-case.js";
import { RememberOwnRoot } from "../contexts/telemetry/application/switch/remember-own-root.use-case.js";
import { WithdrawConsent } from "../contexts/telemetry/application/switch/withdraw-consent.use-case.js";
import { environmentWithoutGitVariables } from "../contexts/telemetry/domain/resolution/git-environment.js";
import { legacyLocations } from "../contexts/telemetry/domain/switch/legacy-locations.js";
import { GitBranchBindingSourceAdapter } from "../contexts/telemetry/infrastructure/git/git-branch-binding-source-adapter.js";
import { GitBranchBindingStoreAdapter } from "../contexts/telemetry/infrastructure/git/git-branch-binding-store-adapter.js";
import { GitConsentAdapter } from "../contexts/telemetry/infrastructure/git/git-consent-adapter.js";
import { GitRepositoryLocatorAdapter } from "../contexts/telemetry/infrastructure/git/git-repository-locator-adapter.js";
import { GitUserSourceAdapter } from "../contexts/telemetry/infrastructure/git/git-user-source-adapter.js";
import {
  claudeConfigDir,
  claudeProjectsRoot,
} from "../contexts/telemetry/infrastructure/sources/claude/claude-config-dir.js";
import { ClaudeSettingsAdapter } from "../contexts/telemetry/infrastructure/sources/claude/claude-settings-adapter.js";
import { ClaudeUsageSourceAdapter } from "../contexts/telemetry/infrastructure/sources/claude/claude-usage-source-adapter.js";
import { codexSessionRoots } from "../contexts/telemetry/infrastructure/sources/codex/codex-session-roots.js";
import { CodexUsageSourceAdapter } from "../contexts/telemetry/infrastructure/sources/codex/codex-usage-source-adapter.js";
import { ConsentHistoryAdapter } from "../contexts/telemetry/infrastructure/storage/consent/consent-history-adapter.js";
import {
  BINDINGS_LOCK_NAME,
  BindingsLockAdapter,
} from "../contexts/telemetry/infrastructure/storage/declarations/bindings-lock-adapter.js";
import { RepositoryDeclarationsAdapter } from "../contexts/telemetry/infrastructure/storage/declarations/repository-declarations-adapter.js";
import { SessionBindingStoreAdapter } from "../contexts/telemetry/infrastructure/storage/declarations/session-binding-store-adapter.js";
import { BindingSnapshotStoreAdapter } from "../contexts/telemetry/infrastructure/storage/ledger/binding-snapshot-store-adapter.js";
import { DirectoryLock } from "../contexts/telemetry/infrastructure/storage/ledger/directory-lock.js";
import { LedgerLock } from "../contexts/telemetry/infrastructure/storage/ledger/ledger-lock.js";
import { LeftOutAdapter } from "../contexts/telemetry/infrastructure/storage/ledger/left-out-adapter.js";
import { RepositoryAliasStoreAdapter } from "../contexts/telemetry/infrastructure/storage/ledger/repository-alias-store-adapter.js";
import { ResolutionStoreAdapter } from "../contexts/telemetry/infrastructure/storage/ledger/resolution-store-adapter.js";
import { UsageLedgerAdapter } from "../contexts/telemetry/infrastructure/storage/ledger/usage-ledger-adapter.js";
import { MeasurementErasureAdapter } from "../contexts/telemetry/infrastructure/storage/measurement-erasure-adapter.js";
import { PersonIdentityAdapter } from "../contexts/telemetry/infrastructure/storage/person-identity-adapter.js";
import type { ConsentHistory } from "../contexts/telemetry/ports/consent-history.js";
import type { UsageSource } from "../contexts/telemetry/ports/usage-source.js";
import type { TelemetryDeps, TelemetryRequests } from "../orchestration/deps.js";
import type { Prompter } from "../orchestration/ports/prompter.js";
import { ChooseIdentity } from "../orchestration/telemetry/choose-identity.use-case.js";
import { EnvironmentAdapter } from "../shared/infrastructure/environment-adapter.js";
import { PrivateStorageAdapter } from "../shared/infrastructure/private-storage-adapter.js";
import type { PrivateStorage } from "../shared/ports/private-storage.js";
import { userConfigDirOf } from "./user-config-dir.js";

/** The requests a command checks before anything is wired: no file, no process, only the clock. */
const consentLogOver = (history: ConsentHistory) => ({
  load: new LoadConsentLog(history),
  record: new RecordConsentEvent(history),
});

export function wireTelemetryRequests(): TelemetryRequests {
  return {
    parseTaskFlags: new ParseTaskFlags(),
    parseReportFlags: new ParseReportFlags(() => new Date()),
    checkTelemetryOn: new CheckTelemetryOn(new CheckIdentity()),
    checkFilterValue: new CheckFilterValue(),
    parseIdentityFlags: new ParseIdentityFlags(),
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

/** The session a declaration binds: the one a hook names (Codex sets no session variable), else
 * Claude Code's. An empty variable is no session. */
export function declaringSessionOf(env: NodeJS.ProcessEnv): string | null {
  return env.AIDD_TELEMETRY_SESSION_ID || env.CLAUDE_CODE_SESSION_ID || null;
}

/** macOS and Windows file systems answer one directory to several spellings. */
export function caseInsensitiveFileSystem(platform: NodeJS.Platform): boolean {
  return platform === "darwin" || platform === "win32";
}

/** The lock on `.lock` in `dir`; it names what it guards in the error of a lock that stays held,
 * the ledger when it names nothing. */
function directoryLock(dir: string, storage: PrivateStorage, name?: string): DirectoryLock {
  return new DirectoryLock({
    dir,
    storage,
    lock: new LedgerLock(join(dir, ".lock"), name === undefined ? {} : { name }),
  });
}

/** What lives on disk: the ledger, the bindings, the consents and the person's identity. */
function wireStores(root: string) {
  const ledgerDir = join(root, "ledger");
  const bindingsDir = join(root, "bindings");
  const storage = new PrivateStorageAdapter();
  const aliases = new RepositoryAliasStoreAdapter(ledgerDir);
  return {
    root,
    ledger: new UsageLedgerAdapter(ledgerDir, storage, {
      leftOut: new LeftOutAdapter(ledgerDir, storage),
      aliases,
      lock: directoryLock(ledgerDir, storage),
    }),
    resolutionStore: new ResolutionStoreAdapter(ledgerDir, storage, aliases),
    consentHistory: new ConsentHistoryAdapter(ledgerDir, storage),
    snapshotStore: new BindingSnapshotStoreAdapter(bindingsDir, storage, aliases),
    bindingsLock: new BindingsLockAdapter(directoryLock(bindingsDir, storage, BINDINGS_LOCK_NAME)),
    sessions: new SessionBindingStoreAdapter(bindingsDir, storage),
    identity: new PersonIdentityAdapter(root, storage),
  };
}

type Stores = ReturnType<typeof wireStores>;

/** What git answers: the repositories, their consents and the branch a task is declared on. */
function wireGit(stores: Stores) {
  const gitEnv = environmentWithoutGitVariables(process.env);
  const locator = new GitRepositoryLocatorAdapter(gitEnv);
  const consents = new GitConsentAdapter(gitEnv);
  const branchSource = new GitBranchBindingSourceAdapter(gitEnv);
  return {
    gitEnv,
    locator,
    consents,
    branchSource,
    branchStore: new GitBranchBindingStoreAdapter(gitEnv),
    repositories: new FindConsentedRepository(
      locator,
      consents,
      new LoadConsentLog(stores.consentHistory)
    ),
    snapshotBindings: new SnapshotBindings({
      source: branchSource,
      store: stores.snapshotStore,
      lock: stores.bindingsLock,
      now: () => new Date(),
    }),
  };
}

type Git = ReturnType<typeof wireGit>;

const processEnvironment = new EnvironmentAdapter();

const environment = {
  caseInsensitiveFileSystem: caseInsensitiveFileSystem(process.platform),
  now: () => new Date(),
};

/** Declaring the task a person works on, and reading which one is declared. */
function wireDeclaration(stores: Stores, git: Git) {
  const declareOnBranch = new DeclareOnBranch(git.branchStore, git.snapshotBindings);
  const readCurrentBranch = new ReadCurrentBranch(git.branchStore, git.branchSource);
  const declaration = {
    environment: processEnvironment,
    sessionId: declaringSessionOf(process.env),
    now: () => new Date(),
  };
  return {
    declareTask: new DeclareTask({
      repositories: git.repositories,
      sessions: stores.sessions,
      branches: declareOnBranch,
      lock: stores.bindingsLock,
      options: declaration,
    }),
    readTelemetryStatus: new ReadTelemetryStatus({
      repositories: git.repositories,
      sessions: stores.sessions,
      branches: readCurrentBranch,
      options: declaration,
      identities: stores.identity,
    }),
  };
}

/** Counting the tokens the measured tools consumed, and reporting them. */
function wireMeasurement(stores: Stores, git: Git, homedir: () => string) {
  // The measured tools, registered once: a tool is one source here and nowhere else.
  const usageSources: readonly UsageSource[] = [
    new ClaudeUsageSourceAdapter(claudeProjectsRoot(process.env.CLAUDE_CONFIG_DIR, homedir())),
    new CodexUsageSourceAdapter({
      roots: codexSessionRoots(process.env.CODEX_HOME, homedir()),
    }),
  ];
  const ingestUsage = new IngestUsage({
    readers: usageSources.map((source) => new ReadUsage(source)),
    ledger: stores.ledger,
    directories: new DirectoryResolver({
      locator: git.locator,
      consentSource: git.consents,
      store: stores.resolutionStore,
      consent: consentLogOver(stores.consentHistory),
      environment,
    }),
    snapshots: git.snapshotBindings,
    options: { environment: processEnvironment },
  });
  const requestReport = new RequestReport(
    new ReportUsage({
      ingest: ingestUsage,
      ledger: stores.ledger,
      declared: new ReadDeclaredBindings(stores.sessions, stores.snapshotStore, stores.identity),
      locator: git.locator,
      environment: processEnvironment,
    })
  );
  return { ingestUsage, requestReport };
}

/** Naming the person the measurement is attributed to. */
function wireIdentity(stores: Stores, git: Git, prompter: Prompter) {
  const manageIdentity = new ManageIdentity(stores.identity);
  const proposeIdentity = new ProposeIdentity(
    new GitUserSourceAdapter(git.gitEnv),
    processEnvironment
  );
  return {
    manageIdentity,
    proposeIdentity,
    chooseIdentity: new ChooseIdentity({
      decideIdentity: new DecideIdentity({ manageIdentity, proposeIdentity }),
      checkIdentity: new CheckIdentity(),
      prompter,
    }),
  };
}

/** Forgetting what was measured: the stores, the legacy locations and every remembered clone. */
function forgetTelemetryOf(stores: Stores, git: Git, homedir: () => string) {
  const { resolutionStore, consentHistory, ledger } = stores;
  return new ForgetTelemetry({
    erasure: new MeasurementErasureAdapter(
      stores.root,
      legacyLocations({
        env: process.env,
        home: homedir(),
        platform: process.platform,
        telemetryDir: stores.root,
      })
    ),
    declarations: new RepositoryDeclarationsAdapter(git.gitEnv),
    remembered: new ReadRememberedClones(resolutionStore, consentHistory, stores.snapshotStore),
    ledger,
  });
}

/** Turning measurement on and off for a repository, and forgetting what was measured. */
function wireConsent(stores: Stores, git: Git, homedir: () => string) {
  const { locator, consents } = git;
  const { ledger, resolutionStore, consentHistory } = stores;
  const cloneConsent = new ReadCloneConsent(locator, consents);
  return {
    readTranscriptRetention: new ReadTranscriptRetention(
      new ClaudeSettingsAdapter(claudeConfigDir(process.env.CLAUDE_CONFIG_DIR, homedir()))
    ),
    enableTelemetry: new EnableTelemetry({
      cloneConsent,
      grant: new GrantConsent({
        consents,
        writer: consents,
        consent: consentLogOver(consentHistory),
        ledger,
        newInterval: () => ({
          token: randomUUID(),
          at: environment.now(),
        }),
      }),
      roots: new RememberOwnRoot(ledger, resolutionStore, environment),
      identities: stores.identity,
    }),
    disableTelemetry: new DisableTelemetry(
      cloneConsent,
      new WithdrawConsent({
        writer: consents,
        consent: consentLogOver(consentHistory),
        ledger,
        now: environment.now,
      })
    ),
    forgetTelemetry: forgetTelemetryOf(stores, git, homedir),
  };
}

export function wireTelemetry(homedir: () => string, prompter: Prompter): TelemetryDeps {
  const stores = wireStores(telemetryDir());
  const git = wireGit(stores);
  return {
    ...wireDeclaration(stores, git),
    ...wireMeasurement(stores, git, homedir),
    ...wireIdentity(stores, git, prompter),
    ...wireConsent(stores, git, homedir),
  };
}
