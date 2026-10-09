import { homedir } from "node:os";
import { join } from "node:path";
import { BranchDeclarations } from "../../contexts/telemetry/application/branch-declarations.js";
import { ConsentedRepositories } from "../../contexts/telemetry/application/consented-repositories.js";
import { DeclareTaskUseCase } from "../../contexts/telemetry/application/declare-task-use-case.js";
import { DirectoryResolver } from "../../contexts/telemetry/application/directory-resolver.js";
import { IngestUsageUseCase } from "../../contexts/telemetry/application/ingest-usage-use-case.js";
import { ReadClaudeUsageUseCase } from "../../contexts/telemetry/application/read-claude-usage-use-case.js";
import { ShowTaskBindingUseCase } from "../../contexts/telemetry/application/show-task-binding-use-case.js";
import { SnapshotBindingsUseCase } from "../../contexts/telemetry/application/snapshot-bindings-use-case.js";
import { claudeProjectsRoot } from "../../contexts/telemetry/domain/claude-projects-root.js";
import { refusedByEnvironment as refusedByEnvironmentValue } from "../../contexts/telemetry/domain/telemetry-consent.js";
import { BindingSnapshotStoreAdapter } from "../../contexts/telemetry/infrastructure/binding-snapshot-store-adapter.js";
import { ClaudeTranscriptSourceAdapter } from "../../contexts/telemetry/infrastructure/claude-transcript-source-adapter.js";
import { ConsentSourceAdapter } from "../../contexts/telemetry/infrastructure/consent-source-adapter.js";
import { GitBranchBindingStoreAdapter } from "../../contexts/telemetry/infrastructure/declaration/git-branch-binding-store-adapter.js";
import { SessionBindingStoreAdapter } from "../../contexts/telemetry/infrastructure/declaration/session-binding-store-adapter.js";
import { GitBranchBindingSourceAdapter } from "../../contexts/telemetry/infrastructure/git-branch-binding-source-adapter.js";
import { GitRepositoryLocatorAdapter } from "../../contexts/telemetry/infrastructure/git-repository-locator-adapter.js";
import { ResolutionStoreAdapter } from "../../contexts/telemetry/infrastructure/resolution-store-adapter.js";
import { UsageLedgerAdapter } from "../../contexts/telemetry/infrastructure/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../filesystem/private-storage-adapter.js";
import { environmentWithoutGitVariables } from "../git/git-environment.js";
import { userConfigDirOf } from "../user-config-dir.js";

export interface TelemetryDeps {
  declareTaskUseCase: DeclareTaskUseCase;
  showTaskBindingUseCase: ShowTaskBindingUseCase;
  ingestUsageUseCase: IngestUsageUseCase;
  snapshotBindingsUseCase: SnapshotBindingsUseCase;
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

/** macOS and Windows file systems answer one directory to several spellings. */
function caseInsensitiveFileSystem(): boolean {
  return process.platform === "darwin" || process.platform === "win32";
}

export function wireTelemetry(homedir: () => string): TelemetryDeps {
  const root = telemetryDir();
  const ledgerDir = join(root, "ledger");
  const storage = new PrivateStorageAdapter();
  const gitEnv = environmentWithoutGitVariables();
  const bindingsDir = join(root, "bindings");
  const branchSource = new GitBranchBindingSourceAdapter(gitEnv);
  const snapshotBindingsUseCase = new SnapshotBindingsUseCase(
    branchSource,
    new BindingSnapshotStoreAdapter(bindingsDir, storage),
    () => new Date()
  );
  const ledger = new UsageLedgerAdapter(ledgerDir, storage);
  const locator = new GitRepositoryLocatorAdapter(gitEnv);
  const consents = new ConsentSourceAdapter();
  const sessions = new SessionBindingStoreAdapter(bindingsDir, storage);
  // An empty variable is no session: only a set, non-empty id is one a declaration can bind.
  const sessionId = process.env.CLAUDE_CODE_SESSION_ID || null;
  const refusedByEnvironment = refusedByEnvironmentValue(process.env.AIDD_TELEMETRY);
  const repositories = new ConsentedRepositories(locator, consents);
  const branchDeclarations = new BranchDeclarations(
    new GitBranchBindingStoreAdapter(gitEnv),
    branchSource,
    snapshotBindingsUseCase
  );
  const declaration = { refusedByEnvironment, sessionId, now: () => new Date() };
  const declareTaskUseCase = new DeclareTaskUseCase(
    repositories,
    sessions,
    branchDeclarations,
    ledger,
    declaration
  );
  const showTaskBindingUseCase = new ShowTaskBindingUseCase(
    repositories,
    sessions,
    branchDeclarations,
    declaration
  );
  const ingestUsageUseCase = new IngestUsageUseCase(
    new ReadClaudeUsageUseCase(
      new ClaudeTranscriptSourceAdapter(
        claudeProjectsRoot(process.env.CLAUDE_CONFIG_DIR, homedir())
      )
    ),
    ledger,
    new DirectoryResolver(
      locator,
      consents,
      new ResolutionStoreAdapter(ledgerDir, storage),
      caseInsensitiveFileSystem()
    ),
    snapshotBindingsUseCase,
    { refusedByEnvironment }
  );
  return {
    declareTaskUseCase,
    showTaskBindingUseCase,
    ingestUsageUseCase,
    snapshotBindingsUseCase,
  };
}
