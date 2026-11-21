import { DirectoryResolver } from "../../../../src/contexts/telemetry/application/directory-resolver.js";
import { IngestUsage } from "../../../../src/contexts/telemetry/application/ingest-usage.use-case.js";
import { ReadUsage } from "../../../../src/contexts/telemetry/application/read-usage.use-case.js";
import { DeclaredBindings } from "../../../../src/contexts/telemetry/application/report/declared-bindings.js";
import { ReportUsage } from "../../../../src/contexts/telemetry/application/report/report-usage.use-case.js";
import { SnapshotBindings } from "../../../../src/contexts/telemetry/application/snapshot-bindings.use-case.js";
import type { Period } from "../../../../src/contexts/telemetry/contract/period.js";
import type { ReportAxis } from "../../../../src/contexts/telemetry/contract/usage-report.js";
import { cloneOf, grantedBy } from "./clone.builder.js";
import { FakeBindings } from "./fake-bindings.fake.js";
import { FakeConsents } from "./fake-consents.fake.js";
import { FakeLocator } from "./fake-locator.fake.js";
import { InMemoryBindingsLock } from "./in-memory-bindings-lock.fake.js";
import { InMemoryConsentHistory } from "./in-memory-consent-history.fake.js";
import { InMemoryIdentity } from "./in-memory-identity.fake.js";
import { InMemoryLedger } from "./in-memory-ledger.fake.js";
import { InMemoryResolutions } from "./in-memory-resolutions.fake.js";
import { InMemorySessions } from "./in-memory-sessions.fake.js";
import { InMemorySnapshots } from "./in-memory-snapshots.fake.js";
import { InMemoryTranscripts } from "./in-memory-transcripts.fake.js";

export const ANY: Period = { from: null, to: null };

export function line(
  id: string,
  output: number,
  at: string,
  session = "s-1",
  branch = "feat/a"
): string {
  return JSON.stringify({
    type: "assistant",
    sessionId: session,
    requestId: `req_${id}`,
    timestamp: at,
    version: "2.1.0",
    cwd: "/work/a",
    gitBranch: branch,
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
  });
}

export function setup(options: { refused?: boolean } = {}) {
  const transcripts = new InMemoryTranscripts();
  const events: string[] = [];
  const ledger = new InMemoryLedger(events);
  const locator = new FakeLocator();
  const consents = new FakeConsents();
  const history = new InMemoryConsentHistory();
  const bindings = new FakeBindings();
  const snapshotStore = new InMemorySnapshots(events);
  const sessions = new InMemorySessions(events);
  const identity = new InMemoryIdentity();
  const ingest = new IngestUsage({
    readers: [new ReadUsage(transcripts)],
    ledger,
    directories: new DirectoryResolver({
      locator,
      consentSource: consents,
      store: new InMemoryResolutions(),
      history,
      environment: {
        caseInsensitiveFileSystem: false,
        now: () => new Date("2026-10-09T00:00:00.000Z"),
      },
    }),
    snapshots: new SnapshotBindings({
      source: bindings,
      store: snapshotStore,
      lock: new InMemoryBindingsLock(),
      now: () => new Date("2026-10-09T00:00:00.000Z"),
    }),
    options: { environment: { get: () => (options.refused ? "0" : undefined) } },
  });
  locator.directories.set("/work/a", {
    status: "repository",
    root: "/work/a",
    mainRoot: "/work/a",
    clone: cloneOf("/work/a/.git"),
    remote: "https://github.com/acme/widgets.git",
    rootCommit: "c0ffee",
  });
  consents.cloneSays(cloneOf("/work/a/.git"), grantedBy(cloneOf("/work/a/.git")));
  history.consented(cloneOf("/work/a/.git"));
  const report = new ReportUsage({
    ingest,
    ledger,
    declared: new DeclaredBindings(sessions, snapshotStore, identity),
    locator,
    environment: {
      get: (name) => (name === "AIDD_TELEMETRY" && options.refused ? "0" : undefined),
    },
  });
  return { transcripts, ledger, bindings, sessions, identity, report, events, locator, consents };
}

export async function rows(s: ReturnType<typeof setup>, axis: ReportAxis, period = ANY) {
  const result = await s.report.execute({ axis, period });
  if (result.status !== "reported") throw new Error("refused");
  return result.report.rows.map((row) => [row.value, row.total.known] as const);
}
