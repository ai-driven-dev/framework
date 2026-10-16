import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../../src/contexts/telemetry/application/directory-resolver.js";
import { IngestUsageUseCase } from "../../../../../src/contexts/telemetry/application/ingest-usage-use-case.js";
import { ReadUsageUseCase } from "../../../../../src/contexts/telemetry/application/read-usage-use-case.js";
import { DeclaredBindings } from "../../../../../src/contexts/telemetry/application/report/declared-bindings.js";
import { reportEnvelopeOf } from "../../../../../src/contexts/telemetry/application/report/report-envelope.js";
import { ReportUsageUseCase } from "../../../../../src/contexts/telemetry/application/report/report-usage-use-case.js";
import { SnapshotBindingsUseCase } from "../../../../../src/contexts/telemetry/application/snapshot-bindings-use-case.js";
import { readClaudeUsageLine } from "../../../../../src/contexts/telemetry/domain/formats/claude-transcript-usage.js";
import type { Period } from "../../../../../src/contexts/telemetry/domain/report/period.js";
import { UsageLedgerAdapter } from "../../../../../src/contexts/telemetry/infrastructure/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../../../../../src/runtime/filesystem/private-storage-adapter.js";
import {
  cloneOf,
  FakeBindings,
  FakeConsents,
  FakeLocator,
  grantedBy,
  InMemoryBindingsLock,
  InMemoryConsentHistory,
  InMemoryIdentity,
  InMemoryResolutions,
  InMemorySessions,
  InMemorySnapshots,
  InMemoryTranscripts,
} from "../../../../helpers/ports/in-memory-telemetry.js";

let root: string;
let runs = 0;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-left-out-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const NOW = new Date("2026-10-09T00:00:00.000Z");
/** Where a call was made: a clone that opted in, one that did not, outside any repository, a
 * directory gone and never seen, and none at all. */
const PLACES = ["/work/in", "/work/out", "/work/none", "/work/gone", undefined] as const;
/** The times a call's snapshots may carry, by the kind of call: either side of a midnight, as a
 * streamed call can be, noon, no time, and a time with no zone. */
const TIMES = [
  ["2026-10-07T23:59:59.000Z", "2026-10-08T00:00:01.000Z"],
  ["2026-10-08T12:00:00.000Z"],
  ["not a time"],
  ["2026-10-08T12:00:00"],
];
/** Lines that are no usage line. */
const JUNK = ["{torn", "[]", '{"type":"assistant","message":{"usage":7}}'];

const transcriptLine = fc.oneof(
  {
    weight: 4,
    arbitrary: fc
      .record({ id: fc.nat(PLACES.length * TIMES.length - 1), output: fc.nat(3), time: fc.nat(1) })
      // A call is made in one place, at one kind of time: only its snapshots differ.
      .map(({ id, output, time }) => {
        const times = TIMES[Math.floor(id / PLACES.length)] as string[];
        return { id, output, place: PLACES[id % PLACES.length], at: times[time % times.length] };
      })
      .map(({ id, output, place, at }) =>
        JSON.stringify({
          type: "assistant",
          sessionId: "s-1",
          requestId: `req_${id}`,
          timestamp: at,
          cwd: place,
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
        })
      ),
  },
  { weight: 1, arbitrary: fc.constantFrom(...JUNK) }
);

const scenario = fc.record({
  files: fc.array(fc.array(transcriptLine, { minLength: 1, maxLength: 6 }), {
    minLength: 1,
    maxLength: 3,
  }),
  // Each ingest before the last: how far each transcript has been written, and whether every
  // position was forgotten first, as a lost offsets file makes it.
  ingests: fc.array(
    fc.record({
      written: fc.array(fc.nat(6), { minLength: 3, maxLength: 3 }),
      forget: fc.boolean(),
    }),
    { maxLength: 4 }
  ),
  period: fc.constantFrom<Period>(
    { from: null, to: null },
    { from: "2026-10-08", to: "2026-10-08" },
    { from: "2026-10-07", to: "2026-10-07" }
  ),
});

function machine() {
  runs += 1;
  const dir = join(root, `ledger-${runs}`);
  const ledger = new UsageLedgerAdapter(dir, new PrivateStorageAdapter());
  const transcripts = new InMemoryTranscripts();
  const locator = new FakeLocator();
  const consents = new FakeConsents();
  const history = new InMemoryConsentHistory();
  for (const place of ["/work/in", "/work/out"]) {
    const clone = cloneOf(`${place}/.git`, { ino: place });
    locator.directories.set(place, {
      status: "repository",
      root: place,
      mainRoot: place,
      clone,
      remote: `https://github.com/acme${place}.git`,
      rootCommit: "c0ffee",
    });
    if (place === "/work/in") {
      consents.cloneSays(clone, grantedBy(clone));
      history.consented(clone);
    }
  }
  locator.directories.set("/work/none", { status: "outside-repository" });
  const snapshots = new SnapshotBindingsUseCase(
    new FakeBindings(),
    new InMemorySnapshots(),
    new InMemoryBindingsLock(),
    () => NOW
  );
  const ingest = new IngestUsageUseCase(
    [new ReadUsageUseCase(transcripts, readClaudeUsageLine)],
    ledger,
    new DirectoryResolver(locator, consents, new InMemoryResolutions(), history, {
      caseInsensitiveFileSystem: false,
      now: () => NOW,
    }),
    snapshots,
    { refusedByEnvironment: false }
  );
  const report = new ReportUsageUseCase(
    ingest,
    ledger,
    new DeclaredBindings(new InMemorySessions(), new InMemorySnapshots()),
    new InMemoryIdentity(),
    locator,
    { refusedByEnvironment: false }
  );
  return { dir, ledger, transcripts, ingest, report };
}

/** Every file under the ledger directory but the offsets and the lock, by its path. */
async function bytes(dir: string): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || ["offsets.json", ".lock"].includes(entry.name)) continue;
    const path = join(entry.parentPath, entry.name);
    found[path.slice(dir.length)] = await readFile(path, "utf8");
  }
  return Object.fromEntries(Object.entries(found).sort(([a], [b]) => (a < b ? -1 : 1)));
}

describe("what ingests leave out, once a report has run", () => {
  it("is kept and reported as one ingest of the same transcripts keeps and reports it, whatever ingested them, how often and from where", async () => {
    await fc.assert(
      fc.asyncProperty(scenario, async ({ files, ingests, period }) => {
        const many = machine();
        for (const { written, forget } of ingests) {
          files.forEach((lines, index) => {
            many.transcripts.files.set(`/t/${index}.jsonl`, lines.slice(0, written[index]));
          });
          if (forget) await many.ledger.savePositions(new Map());
          await many.ingest.execute();
        }
        const one = machine();
        for (const m of [many, one]) {
          for (const [index, lines] of files.entries()) {
            m.transcripts.files.set(`/t/${index}.jsonl`, lines);
          }
          await m.ingest.execute();
        }
        const reported = await Promise.all(
          [many, one].map((m) => m.report.execute({ axis: "total", period }))
        );
        const envelopes = reported.map((result) => {
          if (result.status !== "reported") throw new Error(result.status);
          return JSON.stringify(reportEnvelopeOf(result));
        });
        expect(envelopes[0]).toBe(envelopes[1]);
        await many.report.execute({ axis: "total", period: { from: null, to: null } });
        await one.report.execute({ axis: "total", period: { from: null, to: null } });
        expect(await bytes(many.dir)).toEqual(await bytes(one.dir));
      }),
      { numRuns: 150 }
    );
  }, 240_000);
});
