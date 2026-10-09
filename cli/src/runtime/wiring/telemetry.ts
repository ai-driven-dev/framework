import { join } from "node:path";
import { DirectoryResolver } from "../../contexts/telemetry/application/directory-resolver.js";
import { IngestUsageUseCase } from "../../contexts/telemetry/application/ingest-usage-use-case.js";
import { ReadClaudeUsageUseCase } from "../../contexts/telemetry/application/read-claude-usage-use-case.js";
import { SnapshotBindingsUseCase } from "../../contexts/telemetry/application/snapshot-bindings-use-case.js";
import { claudeProjectsRoot } from "../../contexts/telemetry/domain/claude-projects-root.js";
import { BindingSnapshotStoreAdapter } from "../../contexts/telemetry/infrastructure/binding-snapshot-store-adapter.js";
import { ClaudeTranscriptSourceAdapter } from "../../contexts/telemetry/infrastructure/claude-transcript-source-adapter.js";
import { ConsentSourceAdapter } from "../../contexts/telemetry/infrastructure/consent-source-adapter.js";
import { GitBranchBindingSourceAdapter } from "../../contexts/telemetry/infrastructure/git-branch-binding-source-adapter.js";
import { GitRepositoryLocatorAdapter } from "../../contexts/telemetry/infrastructure/git-repository-locator-adapter.js";
import { ResolutionStoreAdapter } from "../../contexts/telemetry/infrastructure/resolution-store-adapter.js";
import { UsageLedgerAdapter } from "../../contexts/telemetry/infrastructure/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../filesystem/private-storage-adapter.js";
import { environmentWithoutGitVariables } from "../git/git-environment.js";
import { userConfigDir } from "../user-config-dir.js";

export interface TelemetryDeps {
  ingestUsageUseCase: IngestUsageUseCase;
  snapshotBindingsUseCase: SnapshotBindingsUseCase;
}

/** Where a person's measurement lives. `AIDD_TELEMETRY_DIR` moves it outright; otherwise it is
 * a subdirectory of the user configuration, apart from the files that live at its root. */
export function telemetryDir(): string {
  const chosen = process.env.AIDD_TELEMETRY_DIR;
  return chosen !== undefined && chosen !== "" ? chosen : join(userConfigDir(), "telemetry");
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
  const snapshotBindingsUseCase = new SnapshotBindingsUseCase(
    new GitBranchBindingSourceAdapter(gitEnv),
    new BindingSnapshotStoreAdapter(join(root, "bindings"), storage),
    () => new Date()
  );
  const ingestUsageUseCase = new IngestUsageUseCase(
    new ReadClaudeUsageUseCase(
      new ClaudeTranscriptSourceAdapter(
        claudeProjectsRoot(process.env.CLAUDE_CONFIG_DIR, homedir())
      )
    ),
    new UsageLedgerAdapter(ledgerDir, storage),
    new DirectoryResolver(
      new GitRepositoryLocatorAdapter(gitEnv),
      new ConsentSourceAdapter(),
      new ResolutionStoreAdapter(ledgerDir, storage),
      caseInsensitiveFileSystem()
    ),
    snapshotBindingsUseCase,
    { refusedByEnvironment: process.env.AIDD_TELEMETRY === "0" }
  );
  return { ingestUsageUseCase, snapshotBindingsUseCase };
}
