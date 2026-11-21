import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git } from "../shared/testing/git-sandbox.builder.js";
import {
  AXES,
  CALLS,
  COUNTERS,
  Journey,
  lines,
  S_CLEARED,
  S_HEADLESS,
  S_MAIN,
  S_OTHER,
  type Session,
} from "./testing/telemetry-journey.builder.js";

let j: Journey;

beforeEach(async () => {
  j = await Journey.open();
});
afterEach(async () => {
  await j.close();
});

describe("the telemetry journey, on the built binary", () => {
  it("opts in, asks once, keeps the task across /clear, and attributes every axis to it", async () => {
    await j.optIn();
    expect(git(j.repo, j.gitEnv, "config", "--local", "--get", "aidd.telemetry").trim()).toMatch(
      /^2:[0-9a-f-]{36}$/u
    );
    // Consent is the clone's own, never a file a team could commit.
    expect(existsSync(join(j.repo, ".aidd", "config.json"))).toBe(false);

    const main: Session = { id: S_MAIN };
    expect(j.sessionStart(main, "startup").stdout).toBe("");

    // Asked, once, before any model call: the person is present on an unbound working branch.
    const asked = j.prompt(main, "build the checkout");
    expect(asked.json?.decision).toBe("block");
    expect(String(asked.json?.reason)).toContain("Telemetry: no task on feat/x yet.");
    expect(existsSync(join(j.telemetry, "bindings", "sessions.jsonl"))).toBe(false);

    // Answered by typing the declaration, which the model never sees.
    const declared = j.prompt(main, "aidd telemetry task checkout-fix --ticket PROJ-12");
    expect(declared.json?.decision).toBe("block");
    expect(declared.json?.reason).toBe(
      "Task checkout-fix (ticket PROJ-12) declared. Send your prompt again."
    );
    expect(declared.json?.hookSpecificOutput).toMatchObject({ suppressOriginalPrompt: true });
    const stored = await lines(join(j.telemetry, "bindings", "sessions.jsonl"));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      session_id: S_MAIN,
      task: "checkout-fix",
      ticket: "PROJ-12",
      none: false,
      by: "hook-intercept",
    });
    expect(
      git(j.repo, j.gitEnv, "config", "--local", "--get", "branch.feat/x.aiddTask").trim()
    ).toBe("checkout-fix");

    // The next prompt passes.
    expect(j.prompt(main, "build the checkout").stdout).toBe("");

    // /clear: a new session in the same process keeps the task, and says so.
    const cleared: Session = { id: S_CLEARED };
    const carried = j.sessionStart(cleared, "clear");
    expect(String(carried.json?.systemMessage)).toContain(
      "Task checkout-fix (ticket PROJ-12) kept after /clear."
    );
    expect(await lines(join(j.telemetry, "bindings", "carries.jsonl"))).toMatchObject([
      { session_id: S_CLEARED, from: S_MAIN },
    ]);
    expect(j.prompt(cleared, "keep going").stdout).toBe("");

    // A headless run on the same branch is never blocked.
    expect(j.prompt({ id: S_HEADLESS, attended: false }, "run the migration").stdout).toBe("");

    const base = Date.now() + 60_000;
    await j.writeTranscripts(base);
    expect((await j.aidd(["identity", "person-a"])).exitCode).toBe(0);

    const days = CALLS.map((call) =>
      new Date(base + call.minute * 60_000).toISOString().slice(0, 10)
    ).sort();
    const [first = "", last = ""] = [days[0], days.at(-1)];
    const oracle = {
      input: CALLS.reduce((n, call) => n + call.input, 0),
      output: CALLS.reduce((n, call) => n + call.output, 0),
      cache_read: CALLS.reduce((n, call) => n + (call.read ?? 0), 0),
      cache_write: CALLS.reduce((n, call) => n + call.write, 0),
    };

    const totals = new Set<number>();
    for (const axis of AXES) {
      const envelope = await j.report(axis, first, last);
      expect(envelope.version).toBe(2);
      expect(envelope.axis).toBe(axis);
      expect(envelope.totals.records, axis).toBe(CALLS.length);
      expect(
        envelope.rows.reduce((n, row) => n + row.records, 0),
        `${axis} records`
      ).toBe(CALLS.length);
      for (const name of COUNTERS) {
        expect(envelope.totals[name].tokens, `${axis} ${name} total`).toBe(oracle[name]);
        expect(
          envelope.rows.reduce((n, row) => n + row[name].tokens, 0),
          `${axis} ${name} rows`
        ).toBe(oracle[name]);
      }
      expect(
        envelope.rows.reduce((n, row) => n + row.total.tokens, 0),
        `${axis} total`
      ).toBe(envelope.totals.total.tokens);
      // The headless call reported no cache read: unknown, never zero, on every axis.
      expect(envelope.totals.cache_read.unknown_records, axis).toBe(1);
      totals.add(envelope.totals.total.tokens);
    }
    expect([...totals]).toEqual([
      oracle.input + oracle.output + oracle.cache_read + oracle.cache_write,
    ]);

    // Every token lands on the declared task and ticket: the first two sessions by their own
    // declaration and the carry (their lines name no branch), the headless one by the branch.
    const task = await j.report("task", first, last);
    expect(task.rows.map((row) => [row.kind, row.key, row.records])).toEqual([
      ["value", "checkout-fix", CALLS.length],
    ]);
    const ticket = await j.report("ticket", first, last);
    expect(ticket.rows.map((row) => [row.kind, row.key, row.records])).toEqual([
      ["value", "PROJ-12", CALLS.length],
    ]);
    const sessions = await j.report("session", first, last);
    expect(sessions.rows.map((row) => row.key).sort()).toEqual(
      [S_MAIN, S_CLEARED, S_HEADLESS].sort()
    );
    expect((await j.report("person", first, last)).rows.map((row) => row.key)).toEqual([
      "person-a",
    ]);
    expect((await j.report("day", first, last)).rows.map((row) => row.key)).toEqual([
      ...new Set(days),
    ]);
  });

  it("asks a person on an unbound branch and never an unattended session", async () => {
    await j.optIn();
    git(j.repo, j.gitEnv, "switch", "-q", "-c", "feat/y");
    const person = j.prompt({ id: S_OTHER }, "start");
    expect(person.json?.decision).toBe("block");
    expect(String(person.json?.reason)).toContain("feat/y");
    expect(j.prompt({ id: S_HEADLESS, attended: false }, "start").stdout).toBe("");
    // Declared none, once: the branch is answered and the same person is no longer asked.
    const none = j.prompt({ id: S_OTHER }, "aidd telemetry task --none");
    expect(String(none.json?.reason)).toBe(
      "No task declared for this work. Send your prompt again."
    );
    expect(j.prompt({ id: S_OTHER }, "start").stdout).toBe("");
  });

  it("shows nothing, blocks nothing and stores nothing in a project that never opted in", async () => {
    const main: Session = { id: S_MAIN };
    expect(j.sessionStart(main, "startup").stdout).toBe("");
    expect(j.prompt(main, "build the checkout").stdout).toBe("");
    expect(j.prompt(main, "aidd telemetry task t").stdout).toBe("");
    expect(existsSync(j.telemetry)).toBe(false);
    expect(existsSync(dirname(join(j.repo, ".aidd", "config.json")))).toBe(false);
  });
});
