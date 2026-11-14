import {
  appendFileSync,
  chmodSync,
  cpSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git } from "../../helpers/git-sandbox.js";
import {
  checkRow,
  HOUR,
  OTHER,
  type Row,
  SHARED,
  startWorld,
  stopWorld,
} from "./testing/consent-world.js";

const LATER_ROWS: readonly Row[] = [
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
      await w.deps.forgetTelemetry.execute({ confirmed: true });
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
    posixOnly: true,
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
      "an opted-in clone whose .git/config cannot be parsed: its calls are counted unreadable, not outside any repository, and stored once it can be read",
    expected: ["c1", "c2"],
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
        await w.deps.declareTask.execute({
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
      await w.deps.forgetTelemetry.execute({ confirmed: true });
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

beforeEach(startWorld);
afterEach(stopWorld);

describe("who is measured, row by row, continued", () => {
  it.each(LATER_ROWS.filter((row) => row.posixOnly !== true))("row $n: $scenario", checkRow);
  it.skipIf(process.platform === "win32").each(LATER_ROWS.filter((row) => row.posixOnly === true))(
    "row $n: $scenario",
    checkRow
  );
});
