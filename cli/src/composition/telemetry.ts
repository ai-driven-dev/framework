import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { BranchDeclarations } from "../contexts/telemetry/application/branch-declarations.js";
import { ConsentedRepositories } from "../contexts/telemetry/application/consented-repositories.js";
import { DeclareTask } from "../contexts/telemetry/application/declare-task.js";
import { DirectoryResolver } from "../contexts/telemetry/application/directory-resolver.js";
import { ForgetTelemetry } from "../contexts/telemetry/application/forget/forget-telemetry.js";
import { ManageIdentity } from "../contexts/telemetry/application/identity/manage-identity.js";
import { ProposeIdentity } from "../contexts/telemetry/application/identity/propose-identity.js";
import { IngestUsage } from "../contexts/telemetry/application/ingest-usage.js";
import { ReadTelemetryStatus } from "../contexts/telemetry/application/read-telemetry-status.js";
import { ReadUsage } from "../contexts/telemetry/application/read-usage.js";
import { DeclaredBindings } from "../contexts/telemetry/application/report/declared-bindings.js";
import { ReportUsage } from "../contexts/telemetry/application/report/report-usage.js";
import { SnapshotBindings } from "../contexts/telemetry/application/snapshot-bindings.js";
import { DisableTelemetry } from "../contexts/telemetry/application/switch/disable-telemetry.js";
import { EnableTelemetry } from "../contexts/telemetry/application/switch/enable-telemetry.js";
import { legacyLocations } from "../contexts/telemetry/domain/legacy/legacy-locations.js";
import { refusedByEnvironment as refusedByEnvironmentValue } from "../contexts/telemetry/domain/telemetry-consent.js";
import { GitBranchBindingSourceAdapter } from "../contexts/telemetry/infrastructure/git/git-branch-binding-source-adapter.js";
import { GitBranchBindingStoreAdapter } from "../contexts/telemetry/infrastructure/git/git-branch-binding-store-adapter.js";
import { GitConsentAdapter } from "../contexts/telemetry/infrastructure/git/git-consent-adapter.js";
import { environmentWithoutGitVariables } from "../contexts/telemetry/infrastructure/git/git-environment.js";
import { GitRepositoryLocatorAdapter } from "../contexts/telemetry/infrastructure/git/git-repository-locator-adapter.js";
import { GitUserSourceAdapter } from "../contexts/telemetry/infrastructure/git/git-user-source-adapter.js";
import { RepositoryAliasStoreAdapter } from "../contexts/telemetry/infrastructure/legacy/repository-alias-store-adapter.js";
import {
  claudeConfigDir,
  claudeProjectsRoot,
} from "../contexts/telemetry/infrastructure/sources/claude/claude-projects-root.js";
import { ClaudeSettingsAdapter } from "../contexts/telemetry/infrastructure/sources/claude/claude-settings-adapter.js";
import { ClaudeTranscriptSourceAdapter } from "../contexts/telemetry/infrastructure/sources/claude/claude-transcript-source-adapter.js";
import {
  CodexTranscriptSourceAdapter,
  codexSessionRoots,
} from "../contexts/telemetry/infrastructure/sources/codex/codex-transcript-source-adapter.js";
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
import type { TelemetryDeps } from "../presentation/deps.js";
import { userConfigDirOf } from "../shared/infrastructure/user-config-dir.js";

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

export function wireTelemetry(homedir: () => string): TelemetryDeps {
  const root = telemetryDir();
  const ledgerDir = join(root, "ledger");
  const storage = new PrivateStorageAdapter();
  const gitEnv = environmentWithoutGitVariables();
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
  const refusedByEnvironment = refusedByEnvironmentValue(process.env.AIDD_TELEMETRY);
  const repositories = new ConsentedRepositories(locator, consents, consentHistory);
  const branchDeclarations = new BranchDeclarations(
    new GitBranchBindingStoreAdapter(gitEnv),
    branchSource,
    snapshotBindings
  );
  const declaration = { refusedByEnvironment, sessionId, now: () => new Date() };
  const declareTask = new DeclareTask(
    repositories,
    sessions,
    branchDeclarations,
    bindingsLock,
    declaration
  );
  const identity = new PersonIdentityAdapter(root, storage);
  const readTelemetryStatus = new ReadTelemetryStatus(
    repositories,
    sessions,
    branchDeclarations,
    declaration,
    identity
  );
  // The measured tools, registered once: a tool is one source here and nowhere else.
  const usageSources: readonly UsageSource[] = [
    new ClaudeTranscriptSourceAdapter(claudeProjectsRoot(process.env.CLAUDE_CONFIG_DIR, homedir())),
    new CodexTranscriptSourceAdapter(codexSessionRoots(process.env.CODEX_HOME, homedir())),
  ];
  const ingestUsage = new IngestUsage(
    usageSources.map((source) => new ReadUsage(source)),
    ledger,
    new DirectoryResolver(locator, consents, resolutionStore, consentHistory, environment),
    snapshotBindings,
    { refusedByEnvironment }
  );
  const claudeDir = claudeConfigDir(process.env.CLAUDE_CONFIG_DIR, homedir());
  return {
    declareTask,
    readTelemetryStatus,
    ingestUsage,
    reportUsage: new ReportUsage(
      ingestUsage,
      ledger,
      new DeclaredBindings(sessions, snapshotStore),
      identity,
      locator,
      { refusedByEnvironment }
    ),
    manageIdentity: new ManageIdentity(identity),
    proposeIdentity: new ProposeIdentity(new GitUserSourceAdapter(gitEnv), refusedByEnvironment),
    enableTelemetry: new EnableTelemetry(
      locator,
      consents,
      consents,
      ledger,
      resolutionStore,
      consentHistory,
      new ClaudeSettingsAdapter(claudeDir),
      environment,
      randomUUID,
      identity
    ),
    disableTelemetry: new DisableTelemetry(
      locator,
      consents,
      consents,
      ledger,
      consentHistory,
      environment.now
    ),
    forgetTelemetry: new ForgetTelemetry(
      new MeasurementErasureAdapter(
        root,
        legacyLocations(process.env, homedir(), process.platform, root)
      ),
      new RepositoryDeclarationsAdapter(gitEnv),
      snapshotStore,
      resolutionStore,
      consentHistory,
      ledger
    ),
  };
}
