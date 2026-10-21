import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as zlib from "node:zlib";
import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../src/contexts/telemetry/application/directory-resolver.js";
import {
  type IngestResult,
  IngestUsageUseCase,
} from "../../../../src/contexts/telemetry/application/ingest-usage-use-case.js";
import { ReadUsageUseCase } from "../../../../src/contexts/telemetry/application/read-usage-use-case.js";
import { SnapshotBindingsUseCase } from "../../../../src/contexts/telemetry/application/snapshot-bindings-use-case.js";
import { readClaudeUsageLine } from "../../../../src/contexts/telemetry/domain/formats/claude-transcript-usage.js";
import { codexUsageReader } from "../../../../src/contexts/telemetry/domain/formats/codex-transcript-usage.js";
import { ClaudeTranscriptSourceAdapter } from "../../../../src/contexts/telemetry/infrastructure/claude-transcript-source-adapter.js";
import { CodexTranscriptSourceAdapter } from "../../../../src/contexts/telemetry/infrastructure/transcripts/codex-transcript-source-adapter.js";
import { UsageLedgerAdapter } from "../../../../src/contexts/telemetry/infrastructure/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/runtime/filesystem/private-storage-adapter.js";
import {
  ALREADY_MIGRATED,
  cloneOf,
  FakeBindings,
  FakeConsents,
  FakeLocator,
  grantedBy,
  InMemoryBindingsLock,
  InMemoryConsentHistory,
  InMemoryResolutions,
  InMemorySnapshots,
} from "../../../helpers/ports/in-memory-telemetry.js";

let root: string;
let runs = 0;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-codex-ingest-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const NOW = new Date("2026-10-09T00:00:00.000Z");
const SESSION = "44444444-4444-4444-8444-444444444444";
const THREAD = "55555555-5555-4555-8555-555555555555";
/** A clone that consents, one that does not, outside any repository, and none. */
const PLACES = ["/work/in", "/work/out", "/work/none", undefined] as const;

function machine(sessions: string, projects?: string) {
  runs += 1;
  const dir = join(root, `ledger-${runs}`);
  const ledger = new UsageLedgerAdapter(dir, new PrivateStorageAdapter());
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
  const ingest = new IngestUsageUseCase(
    [
      new ReadUsageUseCase(new CodexTranscriptSourceAdapter([sessions]), codexUsageReader),
      ...(projects === undefined
        ? []
        : [
            new ReadUsageUseCase(
              new ClaudeTranscriptSourceAdapter(projects),
              () => readClaudeUsageLine
            ),
          ]),
    ],
    ledger,
    new DirectoryResolver(locator, consents, new InMemoryResolutions(), history, {
      caseInsensitiveFileSystem: false,
      now: () => NOW,
    }),
    new SnapshotBindingsUseCase(
      new FakeBindings(),
      new InMemorySnapshots(),
      new InMemoryBindingsLock(),
      () => NOW
    ),
    { refusedByEnvironment: false },
    ALREADY_MIGRATED
  );
  return { dir, ingest };
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

/** What runs say that adds up across them. */
function counts(results: readonly IngestResult[]) {
  return {
    unrecognised: results.reduce((all, r) => all + r.unrecognised, 0),
    notStored: Object.fromEntries(
      Object.keys(results[0]?.notStored ?? {}).map((reason) => [
        reason,
        results.reduce((all, r) => all + r.notStored[reason as keyof IngestResult["notStored"]], 0),
      ])
    ),
  };
}

const entry = (type: string, payload: Record<string, unknown>, at = "2026-10-08T12:00:00.000Z") =>
  JSON.stringify({ timestamp: at, type, payload });

const call = (n: number, sub: boolean, at: string, total: number) =>
  entry(
    "token_usage_record",
    {
      response_id: `resp_${n}`,
      session_id: SESSION,
      thread_id: sub ? THREAD : SESSION,
      usage: {
        input_tokens: total,
        cached_input_tokens: 1,
        cache_write_input_tokens: 0,
        output_tokens: 2,
        reasoning_output_tokens: 1,
        total_tokens: total + 2,
      },
    },
    at
  );

const line = fc.oneof(
  {
    weight: 1,
    arbitrary: fc
      .constantFrom(...PLACES)
      .map((cwd) => entry("session_meta", { session_id: SESSION, cwd, cli_version: "0.160.0" })),
  },
  {
    weight: 2,
    arbitrary: fc
      .tuple(fc.constantFrom(...PLACES), fc.constantFrom("gpt-5.5", "gpt-5.6"))
      .map(([cwd, model]) => entry("turn_context", { cwd, model })),
  },
  {
    weight: 4,
    arbitrary: fc
      .record({
        sub: fc.boolean(),
        at: fc.constantFrom("2026-10-07T23:59:59.000Z", "2026-10-08T12:00:00.000Z", "not a time"),
        total: fc.integer({ min: 1, max: 9 }),
      })
      .map((c) => (n: number) => call(n, c.sub, c.at, c.total)),
  },
  {
    weight: 1,
    arbitrary: fc.constantFrom(
      "{torn",
      "",
      '{"type":"token_usage_record",torn',
      entry("token_usage_record", { session_id: SESSION }),
      entry("event_msg", { type: "token_count" })
    ),
  }
);

/** A session file whose calls each have their own response id, as every one observed did. */
const sessionFile = fc
  .array(fc.record({ line, end: fc.constantFrom("\n", "\r\n") }), { minLength: 1, maxLength: 10 })
  .chain((lines) => {
    const bytes = Buffer.from(
      lines.map(({ line, end }, n) => `${typeof line === "string" ? line : line(n)}${end}`).join("")
    );
    return fc.record({
      bytes: fc.constant(bytes),
      cuts: fc
        .array(fc.nat(bytes.length), { maxLength: 3 })
        .map((cuts) => cuts.sort((a, b) => a - b)),
    });
  });

describe("ingesting a Codex session file as it grows (P1)", () => {
  it("stores the same ledger, offsets and left-out bytes as one ingest of the whole file, and its runs' counts add up to that one's", async () => {
    await fc.assert(
      fc.asyncProperty(sessionFile, async ({ bytes: content, cuts }) => {
        const sessions = join(root, `sessions-${runs}`);
        await mkdir(sessions, { recursive: true });
        const path = join(sessions, "rollout-a.jsonl");
        const growing = machine(sessions);
        const results: IngestResult[] = [];
        for (const cut of [...cuts, content.length]) {
          await writeFile(path, content.subarray(0, cut));
          results.push(await growing.ingest.execute());
        }
        const once = machine(sessions);
        const whole = await once.ingest.execute();
        expect(await bytes(growing.dir)).toEqual(await bytes(once.dir));
        expect(counts(results)).toEqual(counts([whole]));
      }),
      { numRuns: 80 }
    );
  }, 240_000);
});

describe.skipIf(typeof zlib.zstdCompressSync !== "function")(
  "a session read plain, then compressed (P3)",
  () => {
    it("stores each of its calls once", async () => {
      const sessions = join(root, "sessions");
      const day = join(sessions, "2026", "10", "08");
      await mkdir(day, { recursive: true });
      const content = [
        entry("session_meta", { session_id: SESSION, cwd: "/work/in" }),
        entry("turn_context", { cwd: "/work/in", model: "gpt-5.5" }),
        call(1, false, "2026-10-08T12:00:00.000Z", 5),
        call(2, true, "2026-10-08T12:00:01.000Z", 7),
        "",
      ].join("\n");
      const { dir, ingest } = machine(sessions);
      await writeFile(join(day, "rollout-a.jsonl"), content);
      const plain = await ingest.execute();
      const stored = await bytes(dir);
      await rm(join(day, "rollout-a.jsonl"));
      await writeFile(
        join(day, "rollout-a.jsonl.zst"),
        zlib.zstdCompressSync(Buffer.from(content))
      );
      const compressed = await ingest.execute();
      expect([plain.added, compressed.added, compressed.updated]).toEqual([2, 0, 0]);
      const after = await bytes(dir);
      const ledgerOnly = (files: Record<string, string>) =>
        Object.fromEntries(
          Object.entries(files).filter(([path]) => !path.endsWith("offsets.json"))
        );
      expect(ledgerOnly(after)).toEqual(ledgerOnly(stored));
    });
  }
);

describe("a compressed session file that does not decompress", () => {
  it("stops no other measurement, and is named again by the next run", async () => {
    const sessions = join(root, "sessions");
    const projects = join(root, "projects", "p");
    await mkdir(sessions, { recursive: true });
    await mkdir(projects, { recursive: true });
    await writeFile(
      join(sessions, "rollout-b.jsonl.zst"),
      Buffer.from("not a zstd frame, only bytes")
    );
    await writeFile(
      join(projects, "s.jsonl"),
      `${JSON.stringify({
        type: "assistant",
        sessionId: "s-1",
        requestId: "req_A",
        timestamp: "2026-10-08T12:00:00.000Z",
        cwd: "/work/in",
        message: {
          id: "msg_A",
          model: "m",
          usage: {
            input_tokens: 1,
            output_tokens: 2,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
        },
      })}\n`
    );
    const { ingest } = machine(sessions, join(root, "projects"));
    const first = await ingest.execute();
    const second = await ingest.execute();
    expect([first.added, first.unrecognised]).toEqual([1, 1]);
    expect([second.added, second.unrecognised]).toEqual([0, 1]);
  });
});
