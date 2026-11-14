import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { git, initRepository } from "../../helpers/git-sandbox.js";
import {
  BEFORE,
  checkRow,
  HOUR,
  OTHER,
  type Row,
  SHARED,
  startWorld,
  stopWorld,
} from "./testing/consent-world.js";

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
      w.rewire();
      w.at(HOUR + 200);
      expect(await w.deps.ingestUsage.execute()).toMatchObject({ refused: true });
      expect(w.stored()).toEqual([]);
      vi.stubEnv("AIDD_TELEMETRY", "");
      w.rewire();
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
      await w.deps.forgetTelemetry.execute({ confirmed: true });
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
      // No clone has opted in yet: the transcript is not even read.
      expect((await w.ingest(0)).filesRead).toBe(0);
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
];

beforeEach(startWorld);
afterEach(stopWorld);

describe("who is measured, row by row", () => {
  it.each(ROWS.filter((row) => row.posixOnly !== true))("row $n: $scenario", checkRow);
  it.skipIf(process.platform === "win32").each(ROWS.filter((row) => row.posixOnly === true))(
    "row $n: $scenario",
    checkRow
  );
});
