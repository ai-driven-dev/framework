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
import { cloneKey } from "../../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { readClaudeUsageLine } from "../../../../../src/contexts/telemetry/domain/formats/claude-transcript-usage.js";
import type { Period } from "../../../../../src/contexts/telemetry/domain/report/period.js";
import { UsageLedgerAdapter } from "../../../../../src/contexts/telemetry/infrastructure/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../../../../../src/runtime/filesystem/private-storage-adapter.js";
import {
  ALREADY_MIGRATED,
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
/** `/work/locked` is a clone that consents and that git refuses to read until the last ingest. */
const PLACES = [
  "/work/in",
  "/work/out",
  "/work/none",
  "/work/gone",
  undefined,
  "/work/locked",
] as const;
const CONSENTING = ["/work/in", "/work/locked"];
/** The times a call's snapshots may carry, by the kind of call: either side of a midnight, as a
 * streamed call can be, noon, no time, and a time with no zone. A call's copies are all of one
 * kind: the contract assumes no call has both a dated and an undated copy. */
const TIMES = [
  ["2026-10-07T23:59:59.000Z", "2026-10-08T00:00:01.000Z"],
  ["2026-10-08T12:00:00.000Z"],
  ["not a time"],
  ["2026-10-08T12:00:00"],
];
const UNDATED_KINDS = [2, 3];
/** Calls with a request id; as many again have none. */
const CALLS = PLACES.length * TIMES.length;
/** A line that is no usage line: naming a place, at a time inside or before any consent, or no
 * time, or naming nothing. */
const junk = fc.oneof(
  fc
    .record({
      place: fc.constantFrom(...PLACES),
      at: fc.constantFrom(undefined, "2026-10-08T12:00:00.000Z", "2025-06-01T00:00:00.000Z"),
    })
    .map(({ place, at }) =>
      JSON.stringify({ type: "assistant", cwd: place, timestamp: at, message: { usage: 7 } })
    ),
  fc.constantFrom("{torn", "[]")
);

const transcriptLine = fc.oneof(
  {
    weight: 4,
    arbitrary: fc
      .record({ id: fc.nat(CALLS * 2 - 1), output: fc.nat(3), time: fc.nat(1) })
      // A call is made in one place, at one kind of time, with or without a request id: only
      // its snapshots differ.
      .map(({ id, output, time }) => {
        const times = TIMES[Math.floor((id % CALLS) / PLACES.length)] as string[];
        const place = PLACES[id % PLACES.length];
        return { id, output, place, at: times[time % times.length], requestless: id >= CALLS };
      })
      .map(({ id, output, place, at, requestless }) =>
        JSON.stringify({
          type: "assistant",
          sessionId: "s-1",
          ...(requestless ? {} : { requestId: `req_${id}` }),
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
  { weight: 1, arbitrary: junk }
);

/** What one machine keeps, by the contract, from these lines: the undated calls, the dated
 * calls with no request id, and the lines that are no usage line of the clone that consents, at
 * a time it consents, each once. */
function expectedLeftOut(lines: readonly string[]) {
  const undated = new Set<number>();
  const requestless = new Set<number>();
  const unrecognised = new Set<string>();
  for (const line of lines) {
    const parsed = (() => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })();
    if (!CONSENTING.includes(parsed?.cwd)) continue;
    if (parsed.message?.id === undefined) {
      if (parsed.timestamp !== "2025-06-01T00:00:00.000Z") unrecognised.add(line);
    } else {
      const id = Number(parsed.message.id.slice(4));
      if (UNDATED_KINDS.includes(Math.floor((id % CALLS) / PLACES.length))) undated.add(id);
      else if (parsed.requestId === undefined) requestless.add(id);
    }
  }
  return { undated: undated.size, unrecognised: unrecognised.size, requestless: requestless.size };
}

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
  for (const place of ["/work/in", "/work/out", "/work/locked"]) {
    const clone = cloneOf(`${place}/.git`, { ino: place });
    locator.directories.set(place, {
      status: "repository",
      root: place,
      mainRoot: place,
      clone,
      remote: `https://github.com/acme${place}.git`,
      rootCommit: "c0ffee",
    });
    if (CONSENTING.includes(place)) {
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
    [new ReadUsageUseCase(transcripts, () => readClaudeUsageLine)],
    ledger,
    new DirectoryResolver(locator, consents, new InMemoryResolutions(), history, {
      caseInsensitiveFileSystem: false,
      now: () => NOW,
    }),
    snapshots,
    { refusedByEnvironment: false },
    ALREADY_MIGRATED
  );
  const report = new ReportUsageUseCase(
    ingest,
    ledger,
    new DeclaredBindings(new InMemorySessions(), new InMemorySnapshots()),
    new InMemoryIdentity(),
    locator,
    { refusedByEnvironment: false }
  );
  const locked = cloneKey(cloneOf("/work/locked/.git", { ino: "/work/locked" }));
  /** Git refuses, or reads again, the clone at `/work/locked`. */
  const lock = (refused: boolean) =>
    refused ? consents.unreadableClones.add(locked) : consents.unreadableClones.delete(locked);
  return { dir, ledger, transcripts, ingest, report, lock };
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
  it("is kept and reported as one ingest of the same transcripts keeps and reports it, whatever ingested them, how often, from where, and while a clone that consents could not be read", async () => {
    await fc.assert(
      fc.asyncProperty(scenario, async ({ files, ingests, period }) => {
        const many = machine();
        many.lock(true);
        for (const { written, forget } of ingests) {
          files.forEach((lines, index) => {
            many.transcripts.files.set(`/t/${index}.jsonl`, lines.slice(0, written[index]));
          });
          if (forget) await many.ledger.savePositions(new Map());
          await many.ingest.execute();
        }
        const one = machine();
        many.lock(false);
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
        const full = await many.report.execute({ axis: "total", period: { from: null, to: null } });
        await one.report.execute({ axis: "total", period: { from: null, to: null } });
        expect(await bytes(many.dir)).toEqual(await bytes(one.dir));
        // A bounded report says what a full one says; both what the contract keeps.
        if (full.status !== "reported" || reported[0]?.status !== "reported") throw new Error();
        expect(reported[0].coverage.leftOut).toEqual(full.coverage.leftOut);
        expect(full.coverage.leftOut).toEqual(expectedLeftOut(files.flat()));
        // A clone that never opted in leaves no byte of this.
        if (
          !files
            .flat()
            .some((line) => CONSENTING.some((place) => line.includes(`"cwd":"${place}"`)))
        ) {
          expect(Object.keys(await bytes(many.dir))).not.toContain("/left-out.txt");
        }
      }),
      { numRuns: 150 }
    );
  }, 240_000);
});
