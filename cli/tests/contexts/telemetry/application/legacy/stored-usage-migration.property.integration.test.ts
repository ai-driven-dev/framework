import { appendFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../../src/contexts/telemetry/application/directory-resolver.js";
import { IngestUsageUseCase } from "../../../../../src/contexts/telemetry/application/ingest-usage-use-case.js";
import { StoredUsageMigration } from "../../../../../src/contexts/telemetry/application/legacy/stored-usage-migration.js";
import { ReadUsageUseCase } from "../../../../../src/contexts/telemetry/application/read-usage-use-case.js";
import { DeclaredBindings } from "../../../../../src/contexts/telemetry/application/report/declared-bindings.js";
import { reportEnvelopeOf } from "../../../../../src/contexts/telemetry/application/report/report-envelope.js";
import { ReportUsageUseCase } from "../../../../../src/contexts/telemetry/application/report/report-usage-use-case.js";
import { SnapshotBindingsUseCase } from "../../../../../src/contexts/telemetry/application/snapshot-bindings-use-case.js";
import type { CloneIdentity } from "../../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { readClaudeUsageLine } from "../../../../../src/contexts/telemetry/domain/formats/claude-transcript-usage.js";
import { legacyRepositoryIdOf } from "../../../../../src/contexts/telemetry/domain/legacy/legacy-repository-identity.js";
import type { PrivateStorage } from "../../../../../src/contexts/telemetry/domain/ports/private-storage.js";
import type { ReportAxis } from "../../../../../src/contexts/telemetry/domain/report/usage-report.js";
import { repositoryIdOf } from "../../../../../src/contexts/telemetry/domain/repository-identity.js";
import {
  renderResolutions,
  resolutionKey,
} from "../../../../../src/contexts/telemetry/domain/repository-resolution.js";
import { dayOf } from "../../../../../src/contexts/telemetry/domain/stored-usage.js";
import { foldUsage } from "../../../../../src/contexts/telemetry/domain/usage-fold.js";
import { BindingSnapshotStoreAdapter } from "../../../../../src/contexts/telemetry/infrastructure/binding-snapshot-store-adapter.js";
import { RepositoryAliasStoreAdapter } from "../../../../../src/contexts/telemetry/infrastructure/legacy/repository-alias-store-adapter.js";
import { ResolutionStoreAdapter } from "../../../../../src/contexts/telemetry/infrastructure/resolution-store-adapter.js";
import { UsageLedgerAdapter } from "../../../../../src/contexts/telemetry/infrastructure/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../../../../../src/runtime/filesystem/private-storage-adapter.js";
import { FailingStorage } from "../../../../helpers/ports/failing-private-storage.js";
import {
  cloneOf,
  FakeBindings,
  FakeConsents,
  FakeLocator,
  grantedBy,
  InMemoryBindingsLock,
  InMemoryConsentHistory,
  InMemoryIdentity,
  InMemorySessions,
  InMemorySnapshots,
  InMemoryTranscripts,
} from "../../../../helpers/ports/in-memory-telemetry.js";

let root: string;
let runs = 0;
function named(prefix: string): string {
  runs += 1;
  return `${prefix}-${runs}`;
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-migration-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const NOW = new Date("2026-10-20T00:00:00.000Z");

/** Clones that consent, by their origin: three spellings of one GitHub repository, a host
 * that keeps its path's case, and a repository with no origin. */
const PLACES: Readonly<Record<string, string | null>> = {
  "/work/a": "git@github.com:Acme/Tool.git",
  "/work/b": "ssh://git@GitHub.com:22/acme/TOOL.git/",
  "/work/c": "https://github.com/acme/tool",
  "/work/d": "ssh://git@Git.Example.org/Team/Repo.git",
  "/work/e": null,
};
const DIRS = Object.keys(PLACES);
const facts = (dir: string) => ({ remote: PLACES[dir] ?? null, rootCommit: "c0ffee" });
const cloneAt = (dir: string): CloneIdentity => cloneOf(`${dir}/.git`, { ino: dir });

/** The copies of one call carry these times: either side of a midnight, or two on one day. */
const TIMES = [
  ["2026-10-07T23:59:59.000Z", "2026-10-08T00:00:01.000Z", "2026-10-08T00:00:03.000Z"],
  ["2026-10-08T12:00:00.000Z", "2026-10-08T12:00:04.000Z"],
  ["2026-10-31T23:59:58.000Z", "2026-11-01T00:00:02.000Z"],
  // Days apart: a requestless call's copies are bound by nothing measured.
  ["2026-10-03T10:00:00.000Z", "2026-10-06T09:00:00.000Z", "2026-10-12T11:00:00.000Z"],
];

interface Copy {
  readonly call: number;
  readonly time: number;
  readonly output: number;
  /** Read by an earlier version, before the migration, rather than after it. */
  readonly before: boolean;
}

const copy = fc.record({
  call: fc.nat(23),
  time: fc.nat(2),
  output: fc.nat(3),
  before: fc.boolean(),
});

/** A call is made in one place, by one session, with or without a request id, on or off the
 * declared branch, and with or without an advisor: only its copies' times and counts differ. */
function lineOf({ call, time, output }: Copy): string {
  const dir = DIRS[call % DIRS.length] as string;
  const times = TIMES[Math.floor(call / 2) % TIMES.length] as string[];
  const requestless = call % 2 === 0;
  const advisor = call % 3 === 0;
  return JSON.stringify({
    type: "assistant",
    sessionId: `s-${call % 4}`,
    ...(requestless ? {} : { requestId: `req_${call}` }),
    timestamp: times[time % times.length],
    cwd: dir,
    gitBranch: call % 5 === 0 ? null : "feat/x",
    message: {
      id: `msg_${call}`,
      model: "m",
      usage: {
        input_tokens: 1,
        output_tokens: output,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        ...(advisor
          ? {
              iterations: [
                { type: "message", cache_creation_input_tokens: 0 },
                { type: "advisor_message", model: "a", input_tokens: 2, output_tokens: output },
              ],
            }
          : {}),
      },
    },
  });
}

/** What cli-v5.5.0 keyed a call by: a requestless call by its own timestamp too. */
function legacyKey(line: string, key: string): string {
  const parsed = JSON.parse(line);
  if (parsed.requestId !== undefined) return key;
  const advisor = key.match(/#advisor\d+$/)?.[0] ?? "";
  return `${key.slice(0, key.length - advisor.length)}:${parsed.timestamp}${advisor}`;
}

const scenario = fc.record({
  copies: fc.array(copy, { minLength: 1, maxLength: 24 }),
  /** How the earlier version's reads were cut: each copy read before goes into one of them. */
  batches: fc.array(fc.nat(3), { minLength: 24, maxLength: 24 }),
  /** Whether October is still in the earlier monthly layout. */
  monthly: fc.boolean(),
  /** Clones git cannot read, or not there (an unmounted volume), at the first run after the
   * upgrade, and back by the next. */
  away: fc.array(
    fc.record({
      dir: fc.constantFrom(...DIRS),
      as: fc.constantFrom("unreadable" as const, "gone" as const),
    }),
    { maxLength: 2 }
  ),
});
type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;

/** Writes, as cli-v5.5.0 left them, the ledger, `roots.json` and branch snapshots of the copies
 * it read: each read's calls folded by its own keys and ids, appended to their days, so a call
 * can sit in several days and a day hold a call twice. */
async function writeEarlierStore(dir: string, bindings: string, s: Scenario): Promise<void> {
  await mkdir(dir, { recursive: true });
  await mkdir(bindings, { recursive: true });
  const before = s.copies.map((c, n) => ({ c, n })).filter(({ c }) => c.before);
  for (let batch = 0; batch < 4; batch += 1) {
    const read = before
      .filter(({ n }) => s.batches[n] === batch)
      .flatMap(({ c }) => {
        const line = lineOf(c);
        const dirOf = JSON.parse(line).cwd as string;
        return readClaudeUsageLine(line).records.map((record) => ({
          ...record,
          key: legacyKey(line, record.key),
          repository_id: legacyRepositoryIdOf(facts(dirOf)) as string,
        }));
      });
    for (const stored of foldUsage(read)) {
      const day = dayOf(stored.at) as string;
      const name = s.monthly && day.startsWith("2026-10") ? day.slice(0, 7) : day;
      await appendFile(join(dir, `${name}.jsonl`), `${JSON.stringify(stored)}\n`);
    }
  }
  await writeRoots(dir, legacyRepositoryIdOf);
  await writeSnapshots(bindings, legacyRepositoryIdOf);
}

/** Every clone, as its `on` recorded it, under the id the rule gives. */
async function writeRoots(dir: string, idOf: typeof repositoryIdOf): Promise<void> {
  await mkdir(dir, { recursive: true });
  const seen = DIRS.map((d) => ({
    dir: d,
    repository_id: idOf(facts(d)) as string,
    root: d,
    clone: cloneAt(d),
    seen_at: NOW.toISOString(),
  }));
  await writeFile(
    join(dir, "roots.json"),
    renderResolutions(new Map(seen.map((r) => [resolutionKey(r.dir, r.clone), r])))
  );
}

/** One declaration of `feat/x` per clone, the task named after the clone, under the id the
 * rule gives: the clones of one repository share one history. */
async function writeSnapshots(bindings: string, idOf: typeof repositoryIdOf): Promise<void> {
  await mkdir(bindings, { recursive: true });
  const lines = DIRS.map((d, n) =>
    JSON.stringify({
      branch: "feat/x",
      task: `task-${d.slice(-1)}`,
      ticket: null,
      declared_at: `2026-10-0${n + 1}T00:00:00.000Z`,
      none: false,
      repository_id: idOf(facts(d)),
      branch_created_at: "2026-09-01T00:00:00.000Z",
      snapshot_at: `2026-10-0${n + 1}T00:00:00.000Z`,
    })
  );
  await writeFile(join(bindings, "branches.jsonl"), `${lines.join("\n")}\n`);
}

function machine(name: string, storage: PrivateStorage = new PrivateStorageAdapter()) {
  const dir = join(root, name, "ledger");
  const bindings = join(root, name, "bindings");
  const ledger = new UsageLedgerAdapter(dir, storage);
  const aliases = new RepositoryAliasStoreAdapter(dir, storage);
  const resolutions = new ResolutionStoreAdapter(dir, storage);
  const transcripts = new InMemoryTranscripts();
  const locator = new FakeLocator();
  const consents = new FakeConsents();
  const history = new InMemoryConsentHistory();
  for (const d of DIRS) {
    const clone = cloneAt(d);
    locator.directories.set(d, {
      status: "repository",
      root: d,
      mainRoot: d,
      clone,
      ...facts(d),
    });
    consents.cloneSays(clone, grantedBy(clone));
    history.consented(clone);
  }
  const snapshots = new BindingSnapshotStoreAdapter(bindings, storage, aliases);
  const ingest = new IngestUsageUseCase(
    [new ReadUsageUseCase(transcripts, readClaudeUsageLine)],
    ledger,
    new DirectoryResolver(locator, consents, resolutions, history, {
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
    new StoredUsageMigration(locator, resolutions, aliases, ledger)
  );
  const report = new ReportUsageUseCase(
    ingest,
    ledger,
    new DeclaredBindings(new InMemorySessions(), snapshots),
    new InMemoryIdentity(),
    locator,
    { refusedByEnvironment: false }
  );
  return { dir, bindings, transcripts, report, locator };
}

const AXES: readonly ReportAxis[] = ["total", "repository", "task", "session", "agent", "day"];

/** Every axis, as the envelope prints it. */
async function figures(m: ReturnType<typeof machine>): Promise<string[]> {
  const out: string[] = [];
  for (const axis of AXES) {
    const result = await m.report.execute({ axis, period: { from: null, to: null } });
    if (result.status !== "reported") throw new Error(result.status);
    out.push(JSON.stringify(reportEnvelopeOf(result)));
  }
  return out;
}

/** Every file under the ledger, but the offsets, the lock and the migration's own table. */
async function bytes(dir: string): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isFile() || ["offsets.json", ".lock", "repository-ids.json"].includes(entry.name))
      continue;
    found[entry.name] = await readFile(join(dir, entry.name), "utf8");
  }
  return Object.fromEntries(Object.entries(found).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** The machine an earlier version left, now run by this one: the copies it read are stored as
 * it stored them, the rest are still to be read. */
async function upgraded(s: Scenario, storage?: PrivateStorage, name = named("up")) {
  const m = machine(name, storage);
  await writeEarlierStore(m.dir, m.bindings, s);
  m.transcripts.files.set("/t/0.jsonl", s.copies.filter((c) => !c.before).map(lineOf));
  return { ...m, name };
}

/** One fresh ingest, under this version's rules, of every copy. */
async function fresh(s: Scenario) {
  const m = machine(named("fresh"));
  await writeSnapshots(m.bindings, repositoryIdOf);
  await writeRoots(m.dir, repositoryIdOf);
  m.transcripts.files.set("/t/0.jsonl", s.copies.map(lineOf));
  return m;
}

describe("stored data from an earlier version, once migrated", () => {
  /** The migrated store reports, and lies on disk, as one fresh ingest does. */
  async function asFresh(s: Scenario): Promise<void> {
    const up = await upgraded(s);
    const one = await fresh(s);
    // The first run after the upgrade, with some clones out of reach; then they are back.
    const back = new Map(s.away.map(({ dir }) => [dir, up.locator.directories.get(dir)]));
    for (const { dir, as } of s.away) up.locator.directories.set(dir, { status: as });
    await up.report.execute({ axis: "total", period: { from: null, to: null } });
    for (const [dir, located] of back) if (located) up.locator.directories.set(dir, located);
    await figures(up);
    await figures(one);
    expect(await figures(up)).toEqual(await figures(one));
    expect(await bytes(up.dir)).toEqual(await bytes(one.dir));
  }

  it("reports, and lies on disk, as one fresh ingest of the same copies under the rules of now", async () => {
    await fc.assert(fc.asyncProperty(scenario, asFresh), { numRuns: 60 });
  }, 240_000);

  it("puts a day it neither re-keys nor re-ids in the order one ingest writes, whatever order it was found in", async () => {
    // Found by the property: two calls of one day, in key order rather than time order, that
    // no rule of now changes, and no later read touches.
    await asFresh({
      copies: [
        { call: 7, time: 0, output: 0, before: true },
        { call: 9, time: 1, output: 0, before: true },
        { call: 0, time: 0, output: 0, before: false },
      ],
      batches: Array.from({ length: 24 }, () => 0),
      monthly: false,
      away: [],
    });
  });

  it("migrated twice is migrated once", async () => {
    await fc.assert(
      fc.asyncProperty(scenario, async (s) => {
        const up = await upgraded(s);
        await figures(up);
        const once = await bytes(up.dir);
        const table = await readFile(join(up.dir, "repository-ids.json"), "utf8");
        const again = machine(up.name);
        await figures(again);
        expect(await bytes(up.dir)).toEqual(once);
        expect(await readFile(join(up.dir, "repository-ids.json"), "utf8")).toBe(table);
      }),
      { numRuns: 30 }
    );
  }, 240_000);

  it("stopped at any write and run again, ends as a run never stopped", async () => {
    await fc.assert(
      fc.asyncProperty(scenario, async (s) => {
        const clean = await upgraded(s);
        await figures(clean);
        const expected = { bytes: await bytes(clean.dir), figures: await figures(clean) };
        for (let failAt = 1; ; failAt += 1) {
          const name = named("crash");
          const crashed = await upgraded(s, new FailingStorage(failAt), name);
          const stopped = await crashed.report
            .execute({ axis: "total", period: { from: null, to: null } })
            .then(
              () => false,
              () => true
            );
          const rerun = machine(name);
          rerun.transcripts.files.set(
            "/t/0.jsonl",
            crashed.transcripts.files.get("/t/0.jsonl") ?? []
          );
          await figures(rerun);
          expect(await figures(rerun)).toEqual(expected.figures);
          expect(await bytes(rerun.dir)).toEqual(expected.bytes);
          if (!stopped) break;
        }
      }),
      { numRuns: 12 }
    );
  }, 240_000);
});
