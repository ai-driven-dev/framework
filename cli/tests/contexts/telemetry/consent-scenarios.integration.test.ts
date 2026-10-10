import { execFileSync, spawnSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type TelemetryDeps, wireTelemetry } from "../../../src/runtime/wiring/telemetry.js";
import { git, initRepository } from "../../helpers/git-sandbox.js";
import { REPOSITORY_ROOT } from "../../helpers/repository-root.js";
import { createTelemetrySandbox, type TelemetrySandbox } from "../../helpers/telemetry-sandbox.js";

/** One predicate, one table: a call is stored only if its directory was seen alive belonging to
 * clone X, X had an open consent interval at the call's time, and `AIDD_TELEMETRY=0` is not set.
 * Measurement starts at `on`: nothing before it is ever stored. Every row runs real git repositories in a temporary directory, the
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
const SESSION = "00000000-0000-4000-8000-000000000001";
const GATE = join(REPOSITORY_ROOT, "plugins", "aidd-telemetry", "hooks", "prompt-gate.cjs");
const FAKE_AIDD = "process.exit(0);\n";

let box: TelemetrySandbox;
let deps: TelemetryDeps;
let base: number;
let calls = 0;

class World {
  constructor(readonly sandbox: TelemetrySandbox) {}

  at(seconds: number): void {
    vi.setSystemTime(base + seconds * 1000);
  }

  /** A repository with a first commit, on `main` or on `branch`; `remote` is its `origin`, none
   * when null. */
  repository(name: string, remote: string | null, branch = "main"): string {
    const dir = join(this.sandbox.root, name);
    initRepository(dir, this.sandbox.gitEnv, remote === null ? {} : { remote });
    if (branch !== "main") git(dir, this.sandbox.gitEnv, "checkout", "-q", "-b", branch);
    return dir;
  }

  /** The real `prompt-gate.cjs`, as Claude Code would run it in `dir`, with a stand-in `aidd`
   * that can answer `telemetry task`. `attended: false` is a headless session. Returns whether
   * the prompt was blocked. It reads the clock of the machine, not the faked one. */
  blocks(dir: string, attended = true): boolean {
    const bin = join(this.sandbox.root, "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, "aidd"), `#!${process.execPath}\n${FAKE_AIDD}`);
    chmodSync(join(bin, "aidd"), 0o755);
    const env: NodeJS.ProcessEnv = {
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      HOME: this.sandbox.home,
      USERPROFILE: this.sandbox.home,
      AIDD_TELEMETRY_DIR: this.sandbox.telemetry,
      CLAUDE_CODE_SESSION_ID: SESSION,
      CLAUDE_CODE_ENTRYPOINT: "cli",
    };
    if (attended) env.CLAUDE_CODE_SESSION_ATTENDED = "1";
    const run = spawnSync(process.execPath, [GATE], {
      cwd: dir,
      env,
      encoding: "utf8",
      input: JSON.stringify({
        session_id: SESSION,
        transcript_path: join(this.sandbox.claude, "projects", "-p", "x.jsonl"),
        cwd: dir,
        prompt: "fix the cart",
        hook_event_name: "UserPromptSubmit",
      }),
    });
    return run.stdout.includes('"decision":"block"');
  }

  /** The consent key set by hand, as a person with git would. */
  key(dir: string, value: string | null): void {
    const args = value === null ? ["--unset"] : [];
    git(
      dir,
      this.sandbox.gitEnv,
      "config",
      "--local",
      ...args,
      "aidd.telemetry",
      ...(value === null ? [] : [value])
    );
  }

  consentsFile(): string {
    return join(this.sandbox.telemetry, "ledger", "consents.jsonl");
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

  async on(dir: string, seconds: number) {
    this.at(seconds);
    return deps.telemetryOnUseCase.execute(dir);
  }

  async off(dir: string, seconds: number) {
    this.at(seconds);
    return deps.telemetryOffUseCase.execute(dir);
  }

  /** The last line of the consent log cut short, as a crash in the middle of a write would. */
  cutLastConsentLine(): void {
    const lines = readFileSync(this.consentsFile(), "utf8").split("\n").filter(Boolean);
    lines[lines.length - 1] = (lines[lines.length - 1] ?? "").slice(0, 40);
    writeFileSync(this.consentsFile(), `${lines.join("\n")}\n`);
  }

  async ingest(seconds: number) {
    this.at(seconds);
    return deps.ingestUsageUseCase.execute();
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
      await w.ingest(0);
      w.removeClone(b2);
      await w.on(b1, HOUR);
      w.call(b1, "b1", HOUR + 100);
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
      await w.on(b1, 3 * HOUR);
      w.call(b1, "b1", 3 * HOUR + 100);
      await w.ingest(3 * HOUR + 200);
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
    scenario: "a linked worktree of an opted-in clone, seen alive, deleted before the next ingest",
    expected: ["a1", "w0", "w1"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      const worktree = join(w.sandbox.root, "a-worktree");
      git(a, w.sandbox.gitEnv, "worktree", "add", "-q", "-b", "feat/y", worktree);
      await w.on(a, HOUR);
      w.call(worktree, "w0", HOUR + 100);
      w.call(a, "a1", HOUR + 100);
      await w.ingest(HOUR + 200);
      rmSync(worktree, { recursive: true, force: true });
      w.call(worktree, "w1", HOUR + 300);
      await w.ingest(HOUR + 400);
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
      w.key(a, "off");
      await w.ingest(2 * HOUR + 100);
      w.call(a, "a2", 2 * HOUR + 200);
      w.removeClone(a);
      await w.on(b, 3 * HOUR);
      w.call(b, "b1", 3 * HOUR + 100);
      await w.ingest(3 * HOUR + 200);
    },
  },
  {
    n: "10",
    scenario: "history before the first on is not stored: measurement starts at on",
    expected: ["a1"],
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
    n: "10b",
    scenario: "history before the first on, never ingested until after it",
    expected: ["a1"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      w.call(a, "a0", BEFORE);
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
      expect(existsSync(w.consentsFile())).toBe(true);
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
      expect(existsSync(w.consentsFile())).toBe(false);
    },
  },
  {
    n: "h1",
    scenario:
      "an old clone never ingested while it lived, the same repository cloned again at its path, on, ingest",
    expected: ["q1"],
    run: async (w) => {
      const old = w.repository("p", SHARED);
      w.call(old, "p1", BEFORE);
      w.removeClone(old);
      const again = w.repository("p", SHARED);
      await w.on(again, HOUR);
      w.call(again, "q1", HOUR + 100);
      await w.ingest(HOUR + 200);
    },
  },
  {
    n: "h1b",
    scenario: "the same, an unrelated repository cloned at the path",
    expected: ["q1"],
    run: async (w) => {
      const old = w.repository("p", SHARED);
      w.call(old, "p1", BEFORE);
      w.removeClone(old);
      const unrelated = w.repository("p", OTHER);
      await w.on(unrelated, HOUR);
      w.call(unrelated, "q1", HOUR + 100);
      await w.ingest(HOUR + 200);
    },
  },
  {
    n: "h1d",
    scenario: "a directory outside any repository refused, then git init, on: nothing comes back",
    expected: ["d2"],
    run: async (w) => {
      const dir = join(w.sandbox.root, "d");
      mkdirSync(dir);
      w.call(dir, "d1", BEFORE);
      const refused = await w.ingest(0);
      expect(refused.notStored["outside-repo"]).toBe(1);
      initRepository(dir, w.sandbox.gitEnv, { remote: SHARED });
      await w.on(dir, HOUR);
      w.call(dir, "d2", HOUR + 100);
      await w.ingest(HOUR + 200);
    },
  },
  ...(["off", null] as const).map(
    (value): Row => ({
      n: `h15 ${value === null ? "--unset" : "off"}`,
      scenario:
        "on, c1, a manual git config change, a headless hook prompt, c2, on, c3, one ingest",
      expected: ["c1", "c3"],
      run: async (w) => {
        const a = w.repository("a", SHARED, "feat/x");
        await w.on(a, -2 * HOUR);
        w.call(a, "c1", -2 * HOUR + 100);
        w.key(a, value);
        expect(w.blocks(a, false)).toBe(false);
        w.call(a, "c2", HOUR);
        await w.on(a, 2 * HOUR);
        w.call(a, "c3", 2 * HOUR + 100);
        await w.ingest(3 * HOUR);
      },
    })
  ),
  {
    n: "h15b",
    scenario:
      "the same with no hook between: c2 is stored, a documented residual limit (nothing saw the key change)",
    expected: ["c1", "c2", "c3"],
    run: async (w) => {
      const a = w.repository("a", SHARED, "feat/x");
      await w.on(a, -2 * HOUR);
      w.call(a, "c1", -2 * HOUR + 100);
      w.key(a, "off");
      w.call(a, "c2", HOUR);
      await w.on(a, 2 * HOUR);
      w.call(a, "c3", 2 * HOUR + 100);
      await w.ingest(3 * HOUR);
    },
  },
  {
    n: "h2",
    scenario: "on, off, the clone moved, on: the calls made while off are not stored",
    expected: ["a1", "a3"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      await w.on(a, HOUR);
      w.call(a, "a1", HOUR + 100);
      await w.off(a, 2 * HOUR);
      w.call(a, "a2", 2 * HOUR + 100);
      const moved = join(w.sandbox.root, "a-moved");
      renameSync(a, moved);
      w.call(moved, "a2m", 2 * HOUR + 200);
      await w.on(moved, 3 * HOUR);
      w.call(moved, "a3", 3 * HOUR + 100);
      await w.ingest(3 * HOUR + 200);
    },
  },
  {
    n: "reverse",
    scenario: "on, c1, off, one ingest at the end",
    expected: ["c1"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      await w.on(a, HOUR);
      w.call(a, "c1", HOUR + 100);
      await w.off(a, 2 * HOUR);
      w.call(a, "c2", 2 * HOUR + 100);
      await w.ingest(3 * HOUR);
    },
  },
  {
    n: "reverse 2",
    scenario: "on, c1, off, c2, on, c3, off, c4, one ingest at the end",
    expected: ["c1", "c3"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      await w.on(a, HOUR);
      w.call(a, "c1", HOUR + 100);
      await w.off(a, 2 * HOUR);
      w.call(a, "c2", 2 * HOUR + 100);
      await w.on(a, 3 * HOUR);
      w.call(a, "c3", 3 * HOUR + 100);
      await w.off(a, 4 * HOUR);
      w.call(a, "c4", 4 * HOUR + 100);
      await w.ingest(5 * HOUR);
    },
  },
  {
    n: "forget-on",
    scenario: "on, c1, off, c2, forget, on, c3: the earlier calls are not stored",
    expected: ["c3"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      await w.on(a, HOUR);
      w.call(a, "c1", HOUR + 100);
      await w.off(a, 2 * HOUR);
      w.call(a, "c2", 2 * HOUR + 100);
      w.at(3 * HOUR);
      await deps.forgetTelemetryUseCase.execute(true);
      await w.on(a, 4 * HOUR);
      w.call(a, "c3", 4 * HOUR + 100);
      await w.ingest(5 * HOUR);
    },
  },
  {
    n: "hand key",
    scenario:
      "a key set by hand (2, or 2:token with no interval), and a cp -R copy of an opted-in clone: nothing stored, the real prompt-gate does not block; the opted-in original stores and blocks",
    expected: ["o1"],
    run: async (w) => {
      const hand = w.repository("hand", OTHER, "feat/y");
      w.key(hand, "2");
      const forged = w.repository("forged", "git@github.com:acme/forged.git", "feat/y");
      w.key(forged, "2:forged-token");
      const original = w.repository("original", SHARED, "feat/z");
      await w.on(original, HOUR);
      const copy = join(w.sandbox.root, "copy");
      cpSync(original, copy, { recursive: true });
      w.call(hand, "m1", HOUR + 100);
      w.call(forged, "f1", HOUR + 100);
      w.call(copy, "cp1", HOUR + 100);
      w.call(original, "o1", HOUR + 100);
      await w.ingest(HOUR + 200);
      expect(w.blocks(hand)).toBe(false);
      expect(w.blocks(forged)).toBe(false);
      expect(w.blocks(copy)).toBe(false);
      expect(w.blocks(original)).toBe(true);
    },
  },
  {
    n: "unstattable",
    scenario:
      "an opted-in clone whose git dir cannot be stat'ed: its own calls are counted unreadable, another clone is still stored, nothing aborts",
    expected: ["b1"],
    run: async (w) => {
      const a = w.repository("locked/a", SHARED);
      const b = w.repository("b", OTHER);
      await w.on(a, HOUR);
      await w.on(b, HOUR);
      w.call(a, "a1", HOUR + 100);
      w.call(b, "b1", HOUR + 100);
      const locked = join(w.sandbox.root, "locked");
      chmodSync(locked, 0o000);
      try {
        const result = await w.ingest(HOUR + 200);
        expect(result.notStored["unreadable-consent"]).toBe(1);
        expect(result.added).toBe(1);
      } finally {
        chmodSync(locked, 0o755);
      }
    },
  },
  {
    n: "unmounted",
    scenario:
      "an opted-in clone out of reach during an ingest, back with the same identity: its calls are stored on, no new on needed",
    expected: ["a1", "a2back", "b1"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      const b = w.repository("b", OTHER);
      await w.on(a, HOUR);
      await w.on(b, HOUR);
      w.call(a, "a1", HOUR + 100);
      await w.ingest(HOUR + 200);
      const away = join(w.sandbox.root, "a.away");
      renameSync(a, away);
      await w.ingest(HOUR + 300);
      renameSync(away, a);
      w.call(a, "a2back", HOUR + 400);
      w.call(b, "b1", HOUR + 400);
      await w.ingest(HOUR + 500);
    },
  },
  {
    n: "unmounted, made again",
    scenario:
      "the same, but another clone is made at the path while it is out of reach: the old one is closed, the new one is not opted in",
    expected: ["a1", "b1"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      const b = w.repository("b", OTHER);
      await w.on(a, HOUR);
      await w.on(b, HOUR);
      w.call(a, "a1", HOUR + 100);
      await w.ingest(HOUR + 200);
      w.removeClone(a);
      await w.ingest(HOUR + 300);
      const again = w.repository("a", SHARED);
      w.call(again, "a2new", HOUR + 400);
      w.call(b, "b1", HOUR + 400);
      const result = await w.ingest(HOUR + 500);
      expect(result.notStored["no-consent"]).toBe(1);
    },
  },
  {
    n: "closed, key put back",
    scenario:
      "an interval closed by a manual off, then its own key put back by hand: the call is not stored, and the report says the consent was closed, not that the clone never opted in",
    expected: ["a1"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      await w.on(a, HOUR);
      const key = git(a, w.sandbox.gitEnv, "config", "--local", "--get", "aidd.telemetry").trim();
      w.call(a, "a1", HOUR + 100);
      w.at(2 * HOUR);
      w.key(a, "off");
      await w.ingest(2 * HOUR + 100);
      w.key(a, key);
      w.call(a, "a2", 2 * HOUR + 200);
      const result = await w.ingest(2 * HOUR + 300);
      expect(result.notStored["consent-closed"]).toBe(1);
      expect(result.notStored["no-consent"]).toBe(0);
    },
  },
  {
    n: "broken config",
    scenario:
      "an opted-in clone whose .git/config cannot be parsed: its calls are counted unreadable, not outside any repository",
    expected: ["c2"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      await w.on(a, HOUR);
      const config = join(a, ".git", "config");
      const sound = readFileSync(config, "utf8");
      w.call(a, "c1", HOUR + 100);
      appendFileSync(config, "[broken\n");
      const result = await w.ingest(HOUR + 200);
      expect(result.notStored["unreadable-consent"]).toBe(1);
      expect(result.notStored["outside-repo"]).toBe(0);
      writeFileSync(config, sound);
      w.call(a, "c2", HOUR + 300);
      await w.ingest(HOUR + 400);
    },
  },
  {
    n: "copy at the path",
    scenario:
      "cp -R of an opted-in clone moved onto the deleted original's path: nothing stored, the real prompt-gate neither blocks nor can be answered, and task does not push it to opt in",
    expected: ["b1"],
    run: async (w) => {
      const a = w.repository("a", SHARED, "feat/z");
      const b = w.repository("b", OTHER, "feat/z");
      await w.on(a, HOUR);
      await w.on(b, HOUR);
      expect(w.blocks(a)).toBe(true);
      const copy = join(w.sandbox.root, "copy");
      cpSync(a, copy, { recursive: true });
      w.removeClone(a);
      renameSync(copy, a);
      w.call(a, "a1", HOUR + 100);
      w.call(b, "b1", HOUR + 100);
      // Before any ingest has seen the swap: the hook alone has to know it is another clone.
      expect(w.blocks(a)).toBe(false);
      expect(w.blocks(b)).toBe(true);
      await w.ingest(HOUR + 200);
      expect(w.blocks(a)).toBe(false);
      expect(
        await deps.declareTaskUseCase.execute({
          cwd: a,
          request: { kind: "task", task: "t1", ticket: null },
          by: "command",
        })
      ).toEqual({ status: "refused", reason: "no-consent" });
    },
  },
  {
    n: "damaged on",
    scenario:
      "on, c1, off, c2, the close line cut, then on: refused, and nothing after it is stored, on every ingest",
    expected: ["c1"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      await w.on(a, HOUR);
      w.call(a, "c1", HOUR + 100);
      await w.ingest(HOUR + 200);
      await w.off(a, 2 * HOUR);
      w.call(a, "c2", 2 * HOUR + 100);
      w.cutLastConsentLine();
      const key = git(a, w.sandbox.gitEnv, "config", "--local", "--get", "aidd.telemetry");
      const refused = await w.on(a, 3 * HOUR);
      expect(refused).toEqual({ status: "refused", reason: "damaged-consent-log" });
      expect(git(a, w.sandbox.gitEnv, "config", "--local", "--get", "aidd.telemetry")).toBe(key);
      w.call(a, "c3", 3 * HOUR + 100);
      const first = await w.ingest(3 * HOUR + 200);
      expect(first.consentLogDamaged).toBe(true);
      const second = await w.ingest(3 * HOUR + 300);
      expect(second.consentLogDamaged).toBe(true);
    },
  },
  {
    n: "damaged off",
    scenario: "on, c1, the log damaged, then off: refused, the key and the log left as they are",
    expected: ["c1"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      await w.on(a, HOUR);
      w.call(a, "c1", HOUR + 100);
      await w.ingest(HOUR + 200);
      appendFileSync(w.consentsFile(), '{"token": "cut\n');
      const before = readFileSync(w.consentsFile(), "utf8");
      const key = git(a, w.sandbox.gitEnv, "config", "--local", "--get", "aidd.telemetry");
      expect(await w.off(a, 2 * HOUR)).toEqual({
        status: "refused",
        reason: "damaged-consent-log",
      });
      expect(readFileSync(w.consentsFile(), "utf8")).toBe(before);
      expect(git(a, w.sandbox.gitEnv, "config", "--local", "--get", "aidd.telemetry")).toBe(key);
    },
  },
  {
    n: "damaged recovery",
    scenario:
      "the log damaged, on refused, then forget --yes and on: nothing from before is stored, what follows is",
    expected: ["c4"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      await w.on(a, HOUR);
      w.call(a, "c1", HOUR + 100);
      await w.off(a, 2 * HOUR);
      w.call(a, "c2", 2 * HOUR + 100);
      w.cutLastConsentLine();
      expect(await w.on(a, 3 * HOUR)).toMatchObject({ status: "refused" });
      w.call(a, "c3", 3 * HOUR + 100);
      w.at(4 * HOUR);
      await deps.forgetTelemetryUseCase.execute(true);
      expect(await w.on(a, 5 * HOUR)).toMatchObject({ status: "on" });
      w.call(a, "c4", 5 * HOUR + 100);
      await w.ingest(6 * HOUR);
    },
  },
  {
    n: "torn tail",
    scenario:
      "on, c1, a write cut short at the end of the log, c2, then off, c3, on, c4: the torn line is not damage, measurement and the next off and on work, c3 is not stored",
    expected: ["c1", "c2", "c4"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      await w.on(a, HOUR);
      w.call(a, "c1", HOUR + 100);
      appendFileSync(w.consentsFile(), '{"token":"cut","clo');
      w.call(a, "c2", HOUR + 200);
      const first = await w.ingest(HOUR + 300);
      expect(first.consentLogDamaged).toBe(false);
      expect(await w.off(a, 2 * HOUR)).toMatchObject({ status: "off" });
      w.call(a, "c3", 2 * HOUR + 100);
      expect(await w.on(a, 3 * HOUR)).toMatchObject({ status: "on" });
      w.call(a, "c4", 3 * HOUR + 100);
      const last = await w.ingest(3 * HOUR + 200);
      expect(last.consentLogDamaged).toBe(false);
    },
  },
  {
    n: "damaged",
    scenario: "a damaged line in consents.jsonl: nothing more is stored, and coverage says why",
    expected: ["c1"],
    run: async (w) => {
      const a = w.repository("a", SHARED);
      await w.on(a, HOUR);
      w.call(a, "c1", HOUR + 100);
      await w.ingest(HOUR + 200);
      appendFileSync(w.consentsFile(), '{"token": "cut\n');
      w.call(a, "c2", HOUR + 300);
      const result = await w.ingest(HOUR + 400);
      expect(result.notStored["unreadable-consent"]).toBe(1);
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
