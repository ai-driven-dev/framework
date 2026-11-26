/**
 * What every host that reports the moment before a tool sends, and the answer that refuses the
 * call, both from captured runs: a hook refused a write to a locked spec in a real session of each
 * host, the file stayed as it was and the model was handed the reason.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  at,
  CWD,
  NOTES,
  output,
  printed,
  printedErr,
  read,
  restoreHostIo,
  sample,
  samples,
} from "./testing/hooks-runtime-host.builder.js";

afterEach(restoreHostIo);

const SPEC = at("aidd_docs/tasks/2026_01/2026_01_02_export/spec.md");
const REASON =
  "aidd_docs/tasks/2026_01/2026_01_02_export/spec.md is locked: only the person who approves it sets its status back to draft. Write nothing to it.";

/** Each host, its fixtures, and how it delivered the refusal: the hook's answer, or its exit. */
const HOSTS = [
  { host: "claude", fixture: "claude-PreToolUse.json", after: "claude-PostToolUse.json" },
  { host: "codex", fixture: "codex-PreToolUse.json", after: "codex-PostToolUse.json" },
  { host: "copilot", fixture: "copilot-PreToolUse.json", after: "copilot-PostToolUse.json" },
  {
    host: "antigravity",
    fixture: "antigravity-PreToolUse.json",
    after: "antigravity-PostToolUse.json",
  },
  { host: "kiro", fixture: "kiro-PreToolUse.json", after: "kiro-PostToolUse.json" },
] as const;

// Every fixture holds the refused write first, then a file created, a file edited, and calls that
// write no file.
describe.each(HOSTS)("$host before a tool", ({ host, fixture, after }) => {
  it("reads the write about to land as the path it will write, and no text", () => {
    const { event } = read(host, sample(fixture, 0).payload);

    expect([event?.event, event?.files, event?.cwd]).toStrictEqual([
      "PreToolUse",
      [{ path: SPEC }],
      CWD,
    ]);
  });

  it("reads a file about to be created and one about to be edited as their paths", () => {
    for (const index of [1, 2]) {
      expect(read(host, sample(fixture, index).payload).event?.files).toStrictEqual([
        { path: NOTES },
      ]);
    }
  });

  it("reads a call that writes no file as no file", () => {
    const rest = samples(fixture).slice(3);

    expect(rest.length).toBeGreaterThan(0);
    for (const { payload } of rest) expect(read(host, payload).event?.files).toStrictEqual([]);
  });

  it("refuses the call about to run the way the host was seen delivering it to the model", () => {
    const { payload, hookAnswer, hookExit, hookStderr } = sample(fixture, 0);
    const { adapter } = read(host, payload);
    adapter.refuse(REASON);

    if (hookExit === undefined) {
      expect(output()).toStrictEqual(hookAnswer);
      return;
    }
    expect([printed, printedErr, process.exitCode]).toStrictEqual([[], [hookStderr], hookExit]);
  });

  it("refuses nothing off the moment before a tool, nor when there is no event", () => {
    const { adapter } = read(host, sample(after, 0).payload);
    adapter.refuse(REASON);
    const none = read(host, "not json");
    none.adapter.refuse(REASON);

    expect([printed, printedErr, process.exitCode]).toStrictEqual([[], [], undefined]);
  });

  it("refuses nothing without a reason", () => {
    const { adapter } = read(host, sample(fixture, 0).payload);
    adapter.refuse("");

    expect([printed, printedErr, process.exitCode]).toStrictEqual([[], [], undefined]);
  });
});
