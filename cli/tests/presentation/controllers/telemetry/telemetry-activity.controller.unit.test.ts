import { describe, expect, it } from "vitest";
import {
  declare,
  ingest,
  installTelemetryIo,
  NOT_STORED,
  run,
  show,
  stderr,
  stdout,
} from "../../../shared/testing/telemetry-command.builder.js";

installTelemetryIo();

describe("aidd telemetry ingest", () => {
  const result = {
    refused: false,
    filesRead: 1,
    added: 2,
    updated: 0,
    unrecognised: 0,
    skippedLedgerLines: 0,
    leftOut: { undated: 0, unrecognised: 0 },
    snapshots: 0,
    notStored: NOT_STORED,
    oldestTranscriptAt: null,
  };

  it("prints what it read", async () => {
    ingest.mockResolvedValue(result);
    await run("ingest");
    expect(stdout()).toContain("Read 1 transcript: 2 calls added");
  });

  it("prints nothing with --quiet", async () => {
    ingest.mockResolvedValue(result);
    await run("ingest", "--quiet");
    expect(stdout()).toBe("");
  });
});

describe("aidd telemetry status", () => {
  it("shows whether this clone is measured and what its work is bound to", async () => {
    show.mockResolvedValue({ status: "refused", reason: "no-consent" });
    // Not measured is an answer, not a failure: no exit code is set.
    expect(await run("status")).toBeNull();
    expect(show).toHaveBeenCalledWith({ cwd: process.cwd() });
  });
});

describe("aidd telemetry task", () => {
  const declared = {
    status: "declared",
    declaration: { task: "checkout", ticket: "P-1", none: false },
    sessionId: null,
    branch: { status: "bound", branch: "feat/x" },
  };

  it("declares the task it is given, with its ticket", async () => {
    declare.mockResolvedValue(declared);
    await run("task", "checkout", "--ticket", "P-1");
    expect(declare).toHaveBeenCalledWith({
      cwd: process.cwd(),
      request: { kind: "task", task: "checkout", ticket: "P-1" },
      by: "command",
    });
  });

  it("declares no task with --none, and marks a hook's declaration", async () => {
    declare.mockResolvedValue(declared);
    await run("task", "--none", "--by", "hook-intercept");
    expect(declare).toHaveBeenCalledWith({
      cwd: process.cwd(),
      request: { kind: "none" },
      by: "hook-intercept",
    });
  });

  const NONE_TAKES_NOTHING =
    "Error: --none declares no task: give it neither a name nor --ticket.\n";
  const NEEDS_A_NAME =
    "Error: A task needs a name: aidd telemetry task <name> [--ticket <ref>], or --none. See what the work is bound to with aidd telemetry status.\n";
  it.each([
    [[], NEEDS_A_NAME],
    [["--none", "t"], NONE_TAKES_NOTHING],
    [["--none", "--ticket", "P-1"], NONE_TAKES_NOTHING],
    [["--ticket", "P-1"], NEEDS_A_NAME],
    [["   "], NEEDS_A_NAME],
  ])("refuses %j before declaring anything, and says why", async (args, message) => {
    expect(await run("task", ...args)).toBe(1);
    expect(stderr()).toBe(message);
    expect(show).not.toHaveBeenCalled();
    expect(declare).not.toHaveBeenCalled();
  });

  it("refuses an unknown declarer, and does not list it in the help", async () => {
    await expect(run("task", "t", "--by", "robot")).rejects.toMatchObject({ exitCode: 1 });
    expect(declare).not.toHaveBeenCalled();
    await expect(run("task", "--help")).rejects.toMatchObject({ exitCode: 0 });
    expect(stdout()).not.toContain("--by");
    expect(stdout()).toContain("--ticket");
  });

  it("exits 1 when the declaration is refused", async () => {
    declare.mockResolvedValue({ status: "refused", reason: "no-consent" });
    expect(await run("task", "x")).toBe(1);
  });
});
