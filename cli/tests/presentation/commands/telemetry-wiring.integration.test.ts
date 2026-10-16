import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  conflictsOf,
  type ReportFilters,
} from "../../../src/contexts/telemetry/domain/report/report-filter.js";

const ingest = vi.fn();
const declare = vi.fn();
const show = vi.fn();
const report = vi.fn();
const identity = { show: vi.fn(), set: vi.fn(), off: vi.fn() };
const turnOn = vi.fn();
const turnOff = vi.fn();
const forget = vi.fn();
const confirm = vi.fn();

vi.mock("../../../src/runtime/wiring/framework.js", () => ({
  createDeps: vi.fn(async () => ({
    prompter: { confirm },
    telemetry: {
      telemetryOnUseCase: { execute: turnOn },
      telemetryOffUseCase: { execute: turnOff },
      forgetTelemetryUseCase: { execute: forget },
      ingestUsageUseCase: { execute: ingest },
      declareTaskUseCase: { execute: declare },
      telemetryStatusUseCase: { execute: show },
      reportUsageUseCase: { execute: report },
      manageIdentityUseCase: identity,
    },
  })),
  createMenuDeps: vi.fn(),
}));

const { registerTelemetryCommand } = await import(
  "../../../src/presentation/commands/telemetry.js"
);

class Exit extends Error {
  constructor(readonly code: number | undefined) {
    super(`exit ${String(code)}`);
  }
}

let out: string[] = [];
let err: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  out = [];
  err = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    out.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    err.push(String(chunk));
    return true;
  });
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Exit(code as number | undefined);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function run(...args: string[]): Promise<number | null> {
  const program = new Command();
  program.exitOverride();
  program.option("--verbose");
  registerTelemetryCommand(program);
  try {
    await program.parseAsync(["node", "aidd", "telemetry", ...args]);
    return null;
  } catch (error) {
    if (error instanceof Exit) return error.code ?? 0;
    throw error;
  }
}
const stdout = () => out.join("");
const stderr = () => err.join("");

const NOT_STORED = {
  "outside-repo": 0,
  "never-seen-alive": 0,
  "no-consent": 0,
  "consent-closed": 0,
  "unreadable-consent": 0,
  "no-cwd": 0,
  undated: 0,
};
const ZERO = { known: 0, unknownRecords: 0 };
const NO_FILTERS = {
  task: null,
  ticket: null,
  person: null,
  model: null,
  agent: null,
  session: null,
  repository: null,
  absent: null,
  unattributed: null,
};
const reported = {
  status: "reported",
  period: { from: null, to: null },
  filters: NO_FILTERS,
  report: {
    axis: "total",
    rows: [],
    totals: {
      records: 0,
      counters: { input: ZERO, output: ZERO, cache_read: ZERO, cache_write: ZERO },
      total: ZERO,
    },
  },
  coverage: {
    filesRead: 0,
    records: 0,
    unrecognised: 0,
    notStored: NOT_STORED,
    oldestTranscriptAt: null,
    skippedLedgerLines: 0,
  },
};

describe("aidd telemetry report", () => {
  it("asks for every day on the total axis when nothing is given, and prints text", async () => {
    report.mockResolvedValue(reported);
    expect(await run("report")).toBeNull();
    expect(report).toHaveBeenCalledWith({
      axis: "total",
      period: { from: null, to: null },
      filters: NO_FILTERS,
    });
    expect(stdout()).toContain("Usage, all days, by total");
  });

  it("passes the axis and the days it was given", async () => {
    report.mockResolvedValue(reported);
    await run("report", "--axis", "task", "--from", "2026-10-01", "--to", "2026-10-07");
    expect(report).toHaveBeenCalledWith({
      axis: "task",
      period: { from: "2026-10-01", to: "2026-10-07" },
      filters: NO_FILTERS,
    });
  });

  it("turns --days into the last days, today included", async () => {
    report.mockResolvedValue(reported);
    await run("report", "--days", "1");
    const [asked] = report.mock.calls[0] as [{ period: { from: string; to: string } }];
    const { period } = asked;
    expect(period.from).toBe(period.to);
  });

  it("prints the versioned envelope with --json, and nothing else", async () => {
    report.mockResolvedValue(reported);
    await run("report", "--json");
    expect(JSON.parse(stdout())).toMatchObject({ version: 1, axis: "total", rows: [] });
  });

  it("prints the refusal envelope with --json when nothing was read", async () => {
    report.mockResolvedValue({ status: "refused" });
    await run("report", "--json");
    expect(JSON.parse(stdout())).toEqual({ version: 1, refused: "AIDD_TELEMETRY=0" });
  });

  it("refuses a bad period before reading anything, with exit 1", async () => {
    expect(await run("report", "--days", "0")).toBe(1);
    expect(stderr()).toContain("--days takes a positive whole number.");
    expect(report).not.toHaveBeenCalled();
  });

  it("refuses an axis it does not know", async () => {
    await expect(run("report", "--axis", "colour")).rejects.toThrow();
  });
});

describe("aidd telemetry report, narrowed", () => {
  const asked = () => (report.mock.calls[0] as [{ filters: unknown }])[0].filters;
  /** Commander refuses a flag value itself: with `exitOverride` it throws its exit code. */
  async function refused(...args: string[]): Promise<number> {
    try {
      const code = await run("report", ...args);
      if (code === null) throw new Error("not refused");
      return code;
    } catch (error) {
      if (error instanceof Error && "exitCode" in error) return error.exitCode as number;
      throw error;
    }
  }

  it("passes every flag it is given, trimmed as a declaration is", async () => {
    report.mockResolvedValue(reported);
    await run(
      "report",
      ...["--task", "  auth refactor ", "--ticket", "PROJ-1", "--person", "p-1"],
      ...["--model", "m-1", "--agent", " subagent", "--session", "a1b2", "--repository", "r-1"]
    );
    expect(asked()).toEqual({
      ...NO_FILTERS,
      task: "auth refactor",
      ticket: "PROJ-1",
      person: "p-1",
      model: "m-1",
      agent: "subagent",
      session: "a1b2",
      repository: "r-1",
    });
    vi.clearAllMocks();
    await run("report", "--absent", " person ");
    expect(asked()).toEqual({ ...NO_FILTERS, absent: "person" });
  });

  it("asks for the repository the command runs in for `.`", async () => {
    report.mockResolvedValue(reported);
    await run("report", "--repository", " . ");
    expect(asked()).toEqual({ ...NO_FILTERS, here: process.cwd() });
  });

  it("reads a bare --unattributed as either reason, and takes one reason", async () => {
    report.mockResolvedValue(reported);
    await run("report", "--unattributed");
    expect(asked()).toEqual({ ...NO_FILTERS, unattributed: "any" });
    vi.clearAllMocks();
    await run("report", "--unattributed", "declared-none", "--axis", "day");
    expect(asked()).toEqual({ ...NO_FILTERS, unattributed: "declared-none" });
  });

  it.each([
    ["an open flag given twice", ["--task", "a", "--task", "b"], "--task"],
    ["a closed flag given twice", ["--agent", "main", "--agent", "main"], "--agent"],
    ["a bare flag given twice", ["--unattributed", "--unattributed"], "--unattributed"],
    ["a value empty once trimmed", ["--ticket", "   "], "--ticket"],
    ["an agent no call can have", ["--agent", "robot"], "--agent"],
    ["an axis no call lacks", ["--absent", "session"], "--absent"],
    ["a reason no call has", ["--unattributed", "no-task"], "--unattributed"],
  ])("refuses %s with exit 1, naming the flag, before reading anything", async (_, args, flag) => {
    expect(await refused(...args)).toBe(1);
    expect(stderr()).toContain(flag);
    expect(report).not.toHaveBeenCalled();
  });

  it("refuses a bare flag given twice by its name, not by the value it was preset to", async () => {
    expect(await refused("--unattributed", "--unattributed")).toBe(1);
    expect(stderr()).toContain("--unattributed is given twice: give it once.");
    expect(stderr()).not.toContain("null");
  });

  it.each([
    [["--unattributed", "--task", "a"], "--task and --unattributed"],
    [["--ticket", "T", "--unattributed", "no-binding"], "--ticket and --unattributed"],
    [["--absent", "ticket", "--unattributed"], "--absent ticket and --unattributed"],
    [["--model", "m", "--absent", "model"], "--model and --absent model"],
  ])(
    "exits 1 on %j, which select on one axis, naming both as the report refuses them",
    async (args, flags) => {
      // The use case's own refusal, as `report-usage-use-case.unit.test.ts` pins it.
      report.mockImplementation(async ({ filters }: { filters: ReportFilters }) => {
        const [conflict] = conflictsOf(filters);
        return conflict === undefined
          ? reported
          : { status: "conflicting", flags: conflict, absent: filters.absent };
      });
      expect(await run("report", ...args)).toBe(1);
      expect(report).toHaveBeenCalledTimes(1);
      expect(stderr()).toContain(flags);
      expect(stdout()).toBe("");
    }
  );

  it.each([
    [{ status: "ambiguous", flag: "session", typed: "a", ids: ["a1", "a2"] }, "a1, a2"],
    [{ status: "not-a-repository" }, "--repository ."],
  ])("exits 1 when the report cannot name what was asked: %j", async (result, said) => {
    report.mockResolvedValue(result);
    expect(await run("report", "--json", "--session", "a")).toBe(1);
    expect(stderr()).toContain(said);
    expect(stdout()).toBe("");
  });
});

describe("aidd telemetry identity", () => {
  it("shows who is named when given nothing", async () => {
    identity.show.mockResolvedValue({ status: "unset" });
    expect(await run("identity")).toBeNull();
    expect(identity.show).toHaveBeenCalled();
    expect(stdout()).toContain("No identity is set");
  });

  it("names the person it is given", async () => {
    identity.set.mockResolvedValue({ status: "set", personId: "person-a" });
    await run("identity", "person-a");
    expect(identity.set).toHaveBeenCalledWith("person-a");
    expect(stdout()).toContain('"person-a"');
  });

  it("removes the identity with --off", async () => {
    identity.off.mockResolvedValue({ status: "removed" });
    await run("identity", "--off");
    expect(identity.off).toHaveBeenCalled();
    expect(stdout()).toContain("removed");
  });

  it("exits 1 for an identifier it refuses", async () => {
    identity.set.mockResolvedValue({ status: "refused" });
    expect(await run("identity", "x")).toBe(1);
  });

  it("refuses --off together with an identifier, touching nothing", async () => {
    expect(await run("identity", "person-a", "--off")).toBe(1);
    expect(stderr()).toContain("--off removes the identity");
    expect(identity.off).not.toHaveBeenCalled();
    expect(identity.set).not.toHaveBeenCalled();
  });
});

describe("aidd telemetry ingest", () => {
  const result = {
    refused: false,
    filesRead: 1,
    added: 2,
    updated: 0,
    unrecognised: 0,
    skippedLedgerLines: 0,
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
    expect(show).toHaveBeenCalledWith(process.cwd());
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

  it("refuses to declare nothing, and points at status", async () => {
    expect(await run("task")).toBe(1);
    expect(stderr()).toContain("aidd telemetry status");
    expect(show).not.toHaveBeenCalled();
    expect(declare).not.toHaveBeenCalled();
  });

  it("refuses --none with a name or a ticket, and a ticket with no name", async () => {
    expect(await run("task", "--none", "x")).toBe(1);
    expect(await run("task", "--none", "--ticket", "P-1")).toBe(1);
    expect(await run("task", "--ticket", "P-1")).toBe(1);
    expect(declare).not.toHaveBeenCalled();
  });

  it("exits 1 when the declaration is refused", async () => {
    declare.mockResolvedValue({ status: "refused", reason: "no-consent" });
    expect(await run("task", "x")).toBe(1);
  });
});

const ON = {
  status: "on",
  consentWritten: true,
  legacyConfig: "none",
  hook: { lineRemoved: false, delegateRemoved: false, stillCalledBy: [] },
  journal: { journalRemoved: false, trackedKept: false, ignoreEntryRemoved: false },
  retention: { days: 3650, short: false },
};

describe("aidd telemetry on", () => {
  it("turns measurement on in the directory it was run from, without asking, with --yes", async () => {
    turnOn.mockResolvedValue(ON);
    expect(await run("on", "--yes")).toBeNull();
    expect(turnOn).toHaveBeenCalledWith(process.cwd());
    expect(confirm).not.toHaveBeenCalled();
    expect(stdout()).toContain("Measurement is on");
  });

  it("refuses to guess an answer where nobody can be asked", async () => {
    const original = process.stdout.isTTY;
    process.stdout.isTTY = false;
    try {
      expect(await run("on")).toBe(1);
    } finally {
      process.stdout.isTTY = original;
    }
    expect(turnOn).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(stderr()).toContain("pass --yes");
  });

  describe("where a person can be asked", () => {
    const original = process.stdout.isTTY;
    beforeEach(() => {
      process.stdout.isTTY = true;
    });
    afterEach(() => {
      process.stdout.isTTY = original;
    });

    it("turns on after a yes, defaulting the question to no", async () => {
      confirm.mockResolvedValue(true);
      turnOn.mockResolvedValue(ON);
      expect(await run("on")).toBeNull();
      expect(confirm.mock.calls[0]?.[1]).toBe(false);
      expect(turnOn).toHaveBeenCalled();
    });

    it("changes nothing after a no", async () => {
      confirm.mockResolvedValue(false);
      expect(await run("on")).toBeNull();
      expect(turnOn).not.toHaveBeenCalled();
      expect(stdout()).toContain("Nothing changed.");
    });
  });

  it("exits 1 when it is refused", async () => {
    turnOn.mockResolvedValue({ status: "refused", reason: "outside-repository" });
    expect(await run("on", "--yes")).toBe(1);
  });
});

describe("aidd telemetry off", () => {
  it("turns measurement off", async () => {
    turnOff.mockResolvedValue({ status: "off", changed: true });
    expect(await run("off")).toBeNull();
    expect(turnOff).toHaveBeenCalledWith(process.cwd());
    expect(stdout()).toContain("Measurement is off");
  });

  it("exits 1 when it is refused", async () => {
    turnOff.mockResolvedValue({ status: "refused", reason: "unreadable-config" });
    expect(await run("off")).toBe(1);
  });
});

describe("aidd telemetry forget", () => {
  const plan = { entries: [], repositories: [], missing: [], unlocated: 0 };

  it("only previews without --yes", async () => {
    forget.mockResolvedValue({ status: "preview", plan });
    expect(await run("forget")).toBeNull();
    expect(forget).toHaveBeenCalledWith(false);
  });

  it("removes with --yes", async () => {
    forget.mockResolvedValue({ status: "forgotten", plan });
    await run("forget", "--yes");
    expect(forget).toHaveBeenCalledWith(true);
  });
});

describe("the telemetry command surface", () => {
  /** What the built binary prints, captured by the help golden: the one place it is pinned. */
  const golden = JSON.parse(
    readFileSync(join(import.meta.dirname, "../../golden/snapshots/help/surface.json"), "utf8")
  ) as { invocation: string; help: string }[];

  it("prints each subcommand's help as the golden pins it", () => {
    const program = new Command().name("aidd");
    registerTelemetryCommand(program);
    const telemetry = program.commands.find((command) => command.name() === "telemetry");
    const helps = [telemetry, ...(telemetry?.commands ?? [])].map((command) => ({
      invocation: command === telemetry ? "aidd telemetry" : `aidd telemetry ${command?.name()}`,
      help: command?.helpInformation().trimEnd(),
    }));
    for (const { invocation, help } of helps) {
      expect(help, invocation).toBe(golden.find((entry) => entry.invocation === invocation)?.help);
    }
  });

  it.each([
    ["status", () => show],
    ["ingest", () => ingest],
    ["forget", () => forget],
    ["report", () => report],
  ])("says what failed and exits 1 when %s throws", async (name, useCase) => {
    useCase().mockRejectedValue(new Error("disk full"));
    expect(await run(name)).toBe(1);
    expect(stderr()).toContain("disk full");
  });
});
