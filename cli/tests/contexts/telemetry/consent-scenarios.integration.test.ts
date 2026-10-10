import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type TelemetryDeps, wireTelemetry } from "../../../src/runtime/wiring/telemetry.js";
import { git, initRepository } from "../../helpers/git-sandbox.js";
import { createTelemetrySandbox, type TelemetrySandbox } from "../../helpers/telemetry-sandbox.js";

/** One predicate, one table: a call is stored only if its directory was seen alive belonging to
 * clone X, X is the clone answering now (or the remembered X when it is gone), and X's consent
 * covered the call's time. Every row runs real git repositories in a temporary directory, the
 * real adapters and a real ingest, and states which calls end up in the ledger. A row that
 * expects a call not to be stored always holds a control that must be: a row cannot pass because
 * ingest stored nothing at all.
 *
 * Time is a number of seconds from `base`. Only `Date` is faked, and the base is the real now,
 * because a clone's birth time is the file system's. A call that must predate a clone born in
 * the row is placed before `base`; one that must follow it, well after. */

const SHARED = "git@github.com:acme/shared.git";
const OTHER = "git@github.com:acme/other.git";
const BEFORE = -50_000;
const HOUR = 3_600;

let box: TelemetrySandbox;
let deps: TelemetryDeps;
let base: number;
let calls = 0;

class World {
  constructor(readonly sandbox: TelemetrySandbox) {}

  at(seconds: number): void {
    vi.setSystemTime(base + seconds * 1000);
  }

  /** A repository on `main` with a first commit; `remote` is its `origin`, none when null. */
  repository(name: string, remote: string | null): string {
    const dir = join(this.sandbox.root, name);
    initRepository(dir, this.sandbox.gitEnv, remote === null ? {} : { remote });
    return dir;
  }

  /** One call, in a session file of its own: no batch ever overwrites an earlier one. */
  call(cwd: string, id: string, seconds: number): void {
    calls += 1;
    const file = join(this.sandbox.claude, "projects", "-p", `session-${calls}.jsonl`);
    mkdirSync(join(this.sandbox.claude, "projects", "-p"), { recursive: true });
    writeFileSync(
      file,
      `${JSON.stringify({
        type: "assistant",
        sessionId: `session-${calls}`,
        requestId: `req_${id}`,
        timestamp: new Date(base + seconds * 1000).toISOString(),
        version: "2.1.0",
        cwd,
        gitBranch: "main",
        message: {
          id: `msg_${id}`,
          model: "m",
          usage: {
            input_tokens: 1,
            output_tokens: 10,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
        },
      })}\n`
    );
  }

  async on(dir: string, seconds: number): Promise<void> {
    this.at(seconds);
    await deps.telemetryOnUseCase.execute(dir);
  }

  async off(dir: string, seconds: number): Promise<void> {
    this.at(seconds);
    await deps.telemetryOffUseCase.execute(dir);
  }

  async ingest(seconds: number): Promise<void> {
    this.at(seconds);
    await deps.ingestUsageUseCase.execute();
  }

  /** The ids of the calls the ledger holds. */
  stored(): string[] {
    const dir = join(this.sandbox.telemetry, "ledger");
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((name) => /^\d{4}-\d{2}\.jsonl$/u.test(name))
      .flatMap((name) => readFileSync(join(dir, name), "utf8").split("\n"))
      .filter((line) => line !== "")
      .map((line) => String(JSON.parse(line).key).replace(/^msg_(.+):req_.*$/u, "$1"))
      .sort();
  }

  /** The clone is moved out of the way rather than deleted: a deleted clone's inode may be given
   * to the next one on some file systems, and a row about a clone told apart from its successor
   * must not depend on that. The path it was at is gone all the same. */
  removeClone(dir: string): void {
    renameSync(dir, `${dir}.removed`);
  }
}

interface Row {
  readonly n: string;
  readonly scenario: string;
  readonly expected: readonly string[];
  readonly run: (world: World) => Promise<void>;
}

const ROWS: readonly Row[] = [
  {
    n: "1",
    scenario:
      "(b) a deleted clone that never opted in, then on in another clone of the same remote",
    expected: ["b1"],
    run: async (w) => {
      const b1 = w.repository("b1", SHARED);
      const b2 = w.repository("b2", SHARED);
      w.call(b2, "b2", BEFORE);
      w.call(b1, "b1", BEFORE);
      await w.ingest(0);
      w.removeClone(b2);
      await w.on(b1, HOUR);
      await w.ingest(2 * HOUR);
    },
  },
  {
    n: "2",
    scenario: "(c) a clone that ran off, then on in another clone of the same remote",
    expected: ["b1", "b2-on"],
    run: async (w) => {
      const b1 = w.repository("b1", SHARED);
      const b2 = w.repository("b2", SHARED);
      await w.on(b2, HOUR);
      w.call(b2, "b2-on", HOUR + 100);
      await w.ingest(HOUR + 200);
      await w.off(b2, 2 * HOUR);
      w.call(b2, "b2-off", 2 * HOUR + 100);
      await w.ingest(2 * HOUR + 200);
      w.removeClone(b2);
      w.call(b1, "b1", 3 * HOUR - 100);
      await w.on(b1, 3 * HOUR);
      await w.ingest(3 * HOUR + 100);
    },
  },
  {
    n: "3",
    scenario:
      "(e) a copy with no remote sharing the root commit, carrying the source's consent, deleted",
    expected: ["s1"],
    run: async (w) => {
      const source = w.repository("source", null);
      await w.on(source, HOUR);
      const copy = join(w.sandbox.root, "copy");
      cpSync(source, copy, { recursive: true });
      w.call(source, "s1", HOUR + 100);
      w.call(copy, "c1", HOUR + 100);
      await w.ingest(HOUR + 200);
      w.removeClone(copy);
      await w.on(source, 2 * HOUR);
      await w.ingest(2 * HOUR + 100);
    },
  },
  {
    n: "4",
    scenario: "a deleted linked worktree of a clone, seen alive before on, then on in that clone",
    expected: ["a1", "w1"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      const worktree = join(w.sandbox.root, "a-worktree");
      git(a, w.sandbox.gitEnv, "worktree", "add", "-q", "-b", "feat/y", worktree);
      w.call(worktree, "w1", BEFORE);
      w.call(a, "a1", BEFORE);
      await w.ingest(0);
      rmSync(worktree, { recursive: true, force: true });
      await w.on(a, HOUR);
      await w.ingest(2 * HOUR);
    },
  },
  {
    n: "5",
    scenario:
      "the same repository cloned again at the same path, then on: the old clone's deleted worktree",
    expected: ["p2"],
    run: async (w) => {
      const old = w.repository("p", SHARED);
      const worktree = join(w.sandbox.root, "p-worktree");
      git(old, w.sandbox.gitEnv, "worktree", "add", "-q", "-b", "feat/y", worktree);
      w.call(worktree, "pw", BEFORE);
      await w.ingest(0);
      w.removeClone(old);
      rmSync(worktree, { recursive: true, force: true });
      const again = w.repository("p", SHARED);
      await w.on(again, HOUR);
      w.call(again, "p2", 2 * HOUR);
      await w.ingest(3 * HOUR);
    },
  },
  {
    n: "6",
    scenario:
      "an unrelated repository cloned at the same path, then on: the old clone's deleted worktree",
    expected: ["p2"],
    run: async (w) => {
      const old = w.repository("p", SHARED);
      const worktree = join(w.sandbox.root, "p-worktree");
      git(old, w.sandbox.gitEnv, "worktree", "add", "-q", "-b", "feat/y", worktree);
      w.call(worktree, "pw", BEFORE);
      await w.ingest(0);
      w.removeClone(old);
      rmSync(worktree, { recursive: true, force: true });
      const unrelated = w.repository("p", OTHER);
      await w.on(unrelated, HOUR);
      w.call(unrelated, "p2", 2 * HOUR);
      await w.ingest(3 * HOUR);
    },
  },
  {
    n: "7",
    scenario:
      "the old clone's own calls, after it is deleted, cloned again at the path, and on runs there",
    expected: ["p2"],
    run: async (w) => {
      const old = w.repository("p", SHARED);
      w.call(old, "po", BEFORE);
      await w.ingest(0);
      w.removeClone(old);
      const again = w.repository("p", SHARED);
      await w.on(again, HOUR);
      w.call(again, "p2", 2 * HOUR);
      await w.ingest(3 * HOUR);
    },
  },
  {
    n: "8",
    scenario: "on, calls, off, calls, on, calls, ingesting after each batch",
    expected: ["a1", "a3"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      await w.on(a, HOUR);
      w.call(a, "a1", HOUR + 100);
      await w.ingest(HOUR + 200);
      await w.off(a, 2 * HOUR);
      w.call(a, "a2", 2 * HOUR + 100);
      await w.ingest(2 * HOUR + 200);
      await w.on(a, 3 * HOUR);
      w.call(a, "a3", 3 * HOUR + 100);
      await w.ingest(3 * HOUR + 200);
    },
  },
  {
    n: "8b",
    scenario: "on, calls, off, calls, on, calls, ingesting once at the end",
    expected: ["a1", "a3"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      await w.on(a, HOUR);
      w.call(a, "a1", HOUR + 100);
      await w.off(a, 2 * HOUR);
      w.call(a, "a2", 2 * HOUR + 100);
      await w.on(a, 3 * HOUR);
      w.call(a, "a3", 3 * HOUR + 100);
      await w.ingest(3 * HOUR + 200);
    },
  },
  {
    n: "9",
    scenario: "on, a manual off an ingest observes, calls, the clone deleted",
    expected: ["a1", "b1"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      const b = w.repository("b", OTHER);
      await w.on(a, HOUR);
      w.call(a, "a1", HOUR + 100);
      await w.ingest(HOUR + 200);
      w.at(2 * HOUR);
      git(a, w.sandbox.gitEnv, "config", "--local", "aidd.telemetry", "off");
      await w.ingest(2 * HOUR + 100);
      w.call(a, "a2", 2 * HOUR + 200);
      w.removeClone(a);
      w.call(b, "b1", 2 * HOUR + 300);
      await w.on(b, 3 * HOUR);
      await w.ingest(3 * HOUR + 100);
    },
  },
  {
    n: "10",
    scenario: "the first on, with history from before it",
    expected: ["a0", "a1"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      w.call(a, "a0", BEFORE);
      await w.ingest(0);
      expect(w.stored()).toEqual([]);
      await w.on(a, HOUR);
      w.call(a, "a1", HOUR + 100);
      await w.ingest(HOUR + 200);
    },
  },
  {
    n: "11",
    scenario: "AIDD_TELEMETRY=0 refuses everything",
    expected: ["a1"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      await w.on(a, HOUR);
      w.call(a, "a1", HOUR + 100);
      vi.stubEnv("AIDD_TELEMETRY", "0");
      deps = wireTelemetry(() => w.sandbox.home);
      w.at(HOUR + 200);
      expect(await deps.ingestUsageUseCase.execute()).toMatchObject({ refused: true });
      expect(w.stored()).toEqual([]);
      vi.stubEnv("AIDD_TELEMETRY", "");
      deps = wireTelemetry(() => w.sandbox.home);
      await w.ingest(HOUR + 300);
    },
  },
  {
    n: "12",
    scenario: "forget --yes after on, with no session",
    expected: [],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      await w.on(a, HOUR);
      expect(existsSync(join(w.sandbox.telemetry, "ledger", "consents.jsonl"))).toBe(true);
      await w.ingest(HOUR + 100);
      w.at(2 * HOUR);
      await deps.forgetTelemetryUseCase.execute(true);
      expect(() =>
        execFileSync("git", ["config", "--local", "--get", "aidd.telemetry"], {
          cwd: a,
          env: w.sandbox.gitEnv,
          stdio: "ignore",
        })
      ).toThrow();
      expect(existsSync(join(w.sandbox.telemetry, "ledger", "consents.jsonl"))).toBe(false);
    },
  },
];

beforeEach(() => {
  box = createTelemetrySandbox();
  for (const [name, value] of Object.entries(box.env())) vi.stubEnv(name, value);
  deps = wireTelemetry(() => box.home);
  base = Date.now();
  calls = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(base);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  rmSync(box.root, { recursive: true, force: true });
});

describe("who is measured, row by row", () => {
  it.each(ROWS)("row $n: $scenario", async (row) => {
    await row.run(new World(box));
    expect(new World(box).stored()).toEqual([...row.expected]);
  });
});
