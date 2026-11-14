import { createHash } from "node:crypto";
import { DirectoryResolver } from "../../../../src/contexts/telemetry/application/directory-resolver.js";
import { IngestUsage } from "../../../../src/contexts/telemetry/application/ingest-usage.js";
import { ReadUsage } from "../../../../src/contexts/telemetry/application/read-usage.js";
import { SnapshotBindings } from "../../../../src/contexts/telemetry/application/snapshot-bindings.js";
import { readClaudeUsageLine } from "../../../../src/contexts/telemetry/infrastructure/sources/claude/claude-transcript-usage.js";
import type { LocatedDirectory } from "../../../../src/contexts/telemetry/ports/repository-locator.js";
import { cloneOf, grantedBy } from "./clone-builders.js";
import { FakeBindings } from "./fake-bindings.js";
import { FakeConsents } from "./fake-consents.js";
import { FakeLocator } from "./fake-locator.js";
import { InMemoryBindingsLock } from "./in-memory-bindings-lock.js";
import { InMemoryConsentHistory } from "./in-memory-consent-history.js";
import { InMemoryLedger } from "./in-memory-ledger.js";
import { InMemoryResolutions } from "./in-memory-resolutions.js";
import { InMemorySnapshots } from "./in-memory-snapshots.js";
import { InMemoryTranscripts } from "./in-memory-transcripts.js";

export const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
export const NOW = new Date("2026-10-09T00:00:00.000Z");
export const NOT_STORED = {
  "outside-repo": 0,
  "never-seen-alive": 0,
  "no-consent": 0,
  "consent-closed": 0,
  "unreadable-consent": 0,
  "no-cwd": 0,
  undated: 0,
};
/** The clone the default directory belongs to. */
export const A = cloneOf("/work/a/.git");

export function line(
  id: string,
  output: number,
  overrides: Record<string, unknown> = {},
  at = "2026-10-07T10:00:00.000Z"
): string {
  return JSON.stringify({
    type: "assistant",
    sessionId: "s-1",
    requestId: `req_${id}`,
    timestamp: at,
    version: "2.1.0",
    cwd: "/work/a",
    gitBranch: "feat/a",
    message: {
      id: `msg_${id}`,
      model: "m",
      usage: {
        input_tokens: 1,
        output_tokens: output,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    },
    ...overrides,
  });
}

export function repository(
  root: string,
  extra: Partial<Extract<LocatedDirectory, { status: "repository" }>> = {}
): LocatedDirectory {
  return {
    status: "repository",
    root,
    mainRoot: root,
    clone: cloneOf(`${extra.mainRoot ?? root}/.git`),
    remote: "https://github.com/acme/widgets.git",
    rootCommit: "c0ffee",
    ...extra,
  };
}

export function setup(options: { refused?: boolean; caseInsensitive?: boolean } = {}) {
  const transcripts = new InMemoryTranscripts();
  /** A second tool's transcripts, read in the same ingest. */
  const other = new InMemoryTranscripts();
  // Another tool's format: the same lines, its own name on every record.
  other.decode = (text) => {
    const read = readClaudeUsageLine(text);
    return { ...read, records: read.records.map((r) => ({ ...r, tool: "codex" as const })) };
  };
  const ledger = new InMemoryLedger();
  const resolutions = new InMemoryResolutions();
  const locator = new FakeLocator();
  const consents = new FakeConsents();
  const history = new InMemoryConsentHistory();
  const bindings = new FakeBindings();
  const snapshotStore = new InMemorySnapshots();
  const snapshots = new SnapshotBindings(
    bindings,
    snapshotStore,
    new InMemoryBindingsLock(),
    () => new Date()
  );
  const ingest = new IngestUsage(
    [
      new ReadUsage(transcripts),
      // Another tool's format: the same lines, its own name on every record.
      new ReadUsage(other),
    ],
    ledger,
    new DirectoryResolver(locator, consents, resolutions, history, {
      caseInsensitiveFileSystem: options.caseInsensitive ?? false,
      now: () => NOW,
    }),
    snapshots,
    { environment: { get: () => (options.refused ? "0" : undefined) } }
  );
  locator.directories.set("/work/a", repository("/work/a"));
  /** The clone at `path` consents: it says so now, and it opted in once. */
  const optIn = (path: string) => {
    consents.cloneSays(cloneOf(path), grantedBy(cloneOf(path)));
    history.consented(cloneOf(path));
  };
  optIn(A.path);
  /** The same ingest, with readers that read every transcript whatever its age. */
  const ingestReadingAll = () =>
    new IngestUsage(
      [transcripts, other].map((source) => {
        const reader = new ReadUsage(source);
        return { execute: (since) => reader.execute(since) } as ReadUsage;
      }),
      ledger,
      new DirectoryResolver(locator, consents, resolutions, history, {
        caseInsensitiveFileSystem: options.caseInsensitive ?? false,
        now: () => NOW,
      }),
      snapshots,
      { environment: { get: () => undefined } }
    );
  return {
    ingestReadingAll,
    transcripts,
    other,
    ledger,
    resolutions,
    locator,
    consents,
    history,
    bindings,
    snapshotStore,
    ingest,
    optIn,
  };
}
