import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../src/contexts/telemetry/application/directory-resolver.js";
import { IngestUsage } from "../../../../src/contexts/telemetry/application/ingest-usage.use-case.js";
import { ReadUsage } from "../../../../src/contexts/telemetry/application/read-usage.use-case.js";
import { SnapshotBindings } from "../../../../src/contexts/telemetry/application/snapshot-bindings.use-case.js";
import { cloneKey } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { ClaudeTranscriptSourceAdapter } from "../../../../src/contexts/telemetry/infrastructure/sources/claude/claude-transcript-source-adapter.js";
import { UsageLedgerAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/ledger/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/private-storage-adapter.js";
import type { UsageSource } from "../../../../src/contexts/telemetry/ports/usage-source.js";
import { cloneOf, grantedBy } from "../testing/clone.builder.js";
import { FakeBindings } from "../testing/fake-bindings.fake.js";
import { FakeConsents } from "../testing/fake-consents.fake.js";
import { FakeLocator } from "../testing/fake-locator.fake.js";
import { InMemoryBindingsLock } from "../testing/in-memory-bindings-lock.fake.js";
import { InMemoryConsentHistory } from "../testing/in-memory-consent-history.fake.js";
import { InMemoryResolutions } from "../testing/in-memory-resolutions.fake.js";
import { InMemorySnapshots } from "../testing/in-memory-snapshots.fake.js";
import { WholeTranscriptReader } from "../testing/whole-transcript-reader.fake.js";

let root: string;
let runs = 0;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-stream-ingest-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const NOW = new Date("2026-10-09T00:00:00.000Z");
/** A clone that consents, one that does not, outside any repository, none, and a clone that
 * consents and git refuses to read until the last ingest, so its transcripts are held. */
const PLACES = ["/work/in", "/work/out", "/work/none", undefined, "/work/locked"] as const;
const CONSENTING = ["/work/in", "/work/locked"];

const usageLine = fc
  .record({
    id: fc.nat(7),
    place: fc.constantFrom(...PLACES),
    at: fc.constantFrom("2026-10-07T23:59:59.000Z", "2026-10-08T12:00:00.000Z", "not a time"),
    output: fc.nat(3),
    note: fc.constantFrom("", "é€𝄞", "\r"),
  })
  .map(({ id, place, at, output, note }) =>
    JSON.stringify({
      type: "assistant",
      sessionId: "s-1",
      requestId: `req_${id}`,
      timestamp: at,
      cwd: place,
      note,
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
  );
/** Lines that are no usage line: one naming a clone, torn JSON, an empty line, a BOM. */
const junk = fc
  .oneof(
    fc.constantFrom(...PLACES).map((place) =>
      JSON.stringify({
        type: "assistant",
        cwd: place,
        timestamp: "2026-10-08T12:00:00.000Z",
        message: { usage: 7 },
      })
    ),
    fc.constantFrom("{torn", "", "\uFEFF{}")
  )
  .map((line) => Buffer.from(line));
const transcript = fc
  .array(
    fc.record({
      line: fc.oneof(
        { weight: 3, arbitrary: usageLine.map((line) => Buffer.from(line)) },
        { weight: 1, arbitrary: junk },
        { weight: 1, arbitrary: fc.constant(Buffer.from([0xff, 0xfe, 0xc3])) }
      ),
      end: fc.constantFrom("\n", "\r\n"),
    }),
    { minLength: 1, maxLength: 8 }
  )
  .chain((lines) => {
    const bytes = Buffer.concat(lines.flatMap(({ line, end }) => [line, Buffer.from(end)]));
    return fc.record({
      bytes: fc.constant(bytes),
      // How far it is written at each ingest before the last: anywhere, mid-line and
      // mid-character included.
      cuts: fc
        .array(fc.nat(bytes.length), { maxLength: 3 })
        .map((cuts) => cuts.sort((a, b) => a - b)),
    });
  });

function machine(source: UsageSource) {
  runs += 1;
  const dir = join(root, `ledger-${runs}`);
  const ledger = new UsageLedgerAdapter(dir, new PrivateStorageAdapter());
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
  const ingest = new IngestUsage({
    readers: [new ReadUsage(source)],
    ledger,
    directories: new DirectoryResolver({
      locator,
      consentSource: consents,
      store: new InMemoryResolutions(),
      history,
      environment: {
        caseInsensitiveFileSystem: false,
        now: () => NOW,
      },
    }),
    snapshots: new SnapshotBindings({
      source: new FakeBindings(),
      store: new InMemorySnapshots(),
      lock: new InMemoryBindingsLock(),
      now: () => NOW,
    }),
    options: { environment: { get: () => undefined } },
  });
  const locked = cloneKey(cloneOf("/work/locked/.git", { ino: "/work/locked" }));
  const lock = (refused: boolean) =>
    refused ? consents.unreadableClones.add(locked) : consents.unreadableClones.delete(locked);
  return { dir, ingest, lock };
}

/** Every file under the ledger directory, offsets included, the lock left out. */
async function bytes(dir: string): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name === ".lock") continue;
    const path = join(entry.parentPath, entry.name);
    found[path.slice(dir.length)] = await readFile(path, "latin1");
  }
  return Object.fromEntries(Object.entries(found).sort(([a], [b]) => (a < b ? -1 : 1)));
}

type Transcript = typeof transcript extends fc.Arbitrary<infer T> ? T : never;

/** Write each transcript as far as this step has got, the last step writing all of it. */
async function writeStep(
  projects: string,
  files: readonly Transcript[],
  step: number,
  last: boolean
) {
  for (const [index, file] of files.entries()) {
    const cut = last ? file.bytes.length : (file.cuts[step] ?? file.bytes.length);
    await writeFile(join(projects, `${index}.jsonl`), file.bytes.subarray(0, cut));
  }
}

async function ingestBoth(machines: ReturnType<typeof machine>[], last: boolean) {
  const results = [];
  for (const m of machines) {
    m.lock(!last);
    results.push(await m.ingest.execute());
  }
  return results;
}

describe("ingesting transcripts read as a stream", () => {
  it("writes the same ledger, offsets and left-out bytes, and says the same, as the whole tail read at once, at any block size and however the transcripts were written between ingests", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(transcript, { minLength: 1, maxLength: 2 }),
        fc.integer({ min: 1, max: 64 }),
        async (files, block) => {
          const projects = join(root, `projects-${runs}`, "p");
          await mkdir(projects, { recursive: true });
          const streamed = machine(new ClaudeTranscriptSourceAdapter(projects, block));
          const whole = machine(new WholeTranscriptReader(projects));
          const steps = Math.max(...files.map((file) => file.cuts.length)) + 1;
          for (let step = 0; step < steps; step += 1) {
            const last = step === steps - 1;
            await writeStep(projects, files, step, last);
            const results = await ingestBoth([streamed, whole], last);
            expect(results[0]).toEqual(results[1]);
            expect(await bytes(streamed.dir)).toEqual(await bytes(whole.dir));
          }
        }
      ),
      { numRuns: 80 }
    );
  }, 240_000);
});
