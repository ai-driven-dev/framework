import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  conflictsOf,
  type ReportFilters,
} from "../../../src/contexts/telemetry/domain/report/report-filter.js";
import { createDeps } from "../../../src/runtime/wiring/framework.js";
import * as otel from "../../../src/runtime/wiring/telemetry-otel.js";

const ingest = vi.fn();
const declare = vi.fn();
const show = vi.fn();
const report = vi.fn();
const identity = { show: vi.fn(), set: vi.fn(), off: vi.fn() };
const turnOn = vi.fn();
const turnOff = vi.fn();
const forget = vi.fn();
const confirm = vi.fn();
const select = vi.fn();
const input = vi.fn();
const propose = vi.fn();
const ensureInstallationId = vi.fn();
const checkInstallationId = vi.fn();
const sessionSnapshot = vi.fn();
const sessionPermits = vi.fn();

vi.mock("../../../src/runtime/wiring/framework.js", () => ({
  createDeps: vi.fn(async () => ({
    ensureInstallationId,
    checkInstallationId,
    prompter: { confirm, select, input },
    telemetry: {
      telemetryOnUseCase: { execute: turnOn },
      telemetryOffUseCase: { execute: turnOff },
      forgetTelemetryUseCase: { execute: forget },
      ingestUsageUseCase: { execute: ingest },
      declareTaskUseCase: { execute: declare },
      telemetryStatusUseCase: { execute: show },
      reportUsageUseCase: { execute: report },
      manageIdentityUseCase: identity,
      proposeIdentityUseCase: { execute: propose },
      sessionFeatureUseCase: { snapshot: sessionSnapshot, permits: sessionPermits },
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
  vi.unstubAllEnvs();
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
  tool: null,
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
  coverage: { records: 0, leftOut: { undated: 0, unrecognised: 0 } },
  run: {
    filesRead: 0,
    unrecognised: 0,
    notStored: NOT_STORED,
    consentLogDamaged: false,
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
    expect(JSON.parse(stdout())).toMatchObject({ version: 2, axis: "total", rows: [] });
  });

  it("prints the refusal envelope with --json when nothing was read", async () => {
    report.mockResolvedValue({ status: "refused" });
    await run("report", "--json");
    expect(JSON.parse(stdout())).toEqual({ version: 2, refused: "AIDD_TELEMETRY=0" });
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
      ...["--model", "m-1", "--agent", " subagent", "--session", "a1b2", "--repository", "r-1"],
      ...["--tool", " codex "]
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
      tool: "codex",
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
    ["a tool no call can have", ["--tool", "robot"], "--tool"],
    ["a tool given twice", ["--tool", "codex", "--tool", "codex"], "--tool"],
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
    expect(show).toHaveBeenCalledWith(process.cwd());
  });

  it("passes the global verbose setting to the telemetry dependencies", async () => {
    show.mockResolvedValue({ status: "refused", reason: "no-consent" });
    expect(await run("status", "--verbose")).toBeNull();
    expect(createDeps).toHaveBeenCalledWith(process.cwd(), { verbose: true }, expect.anything());
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
    expect(await run("task", "checkout", "--ticket", "P-1")).toBeNull();
    expect(stdout()).toContain('Declared task "checkout"');
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
    expect(stderr()).toContain("no task was declared");
  });
});

const ON = {
  status: "on",
  consentWritten: true,
  legacyConfig: "none",
  hook: { lineRemoved: false, delegateRemoved: false, stillCalledBy: [] },
  journal: { journalRemoved: false, trackedKept: false, ignoreEntryRemoved: false },
  retention: { days: 3650, short: false },
  identity: { personId: null, previous: null },
};

describe("aidd telemetry on", () => {
  const ANONYMOUS = { status: "unset" };
  const NAMED = { status: "set", personId: "Ada Example" };
  beforeEach(() => {
    identity.show.mockResolvedValue(ANONYMOUS);
    turnOn.mockResolvedValue(ON);
  });

  it("turns measurement on in the directory it was run from, without asking, with --yes and a choice", async () => {
    expect(await run("on", "--yes", "--anonymous")).toBeNull();
    expect(turnOn).toHaveBeenCalledWith(process.cwd(), "none");
    expect(ensureInstallationId).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
    expect(stdout()).toContain("Measurement is on");
  });

  it("names the person given with --as", async () => {
    expect(await run("on", "--yes", "--as", "Ada Example")).toBeNull();
    expect(turnOn).toHaveBeenCalledWith(process.cwd(), { set: "Ada Example" });
  });

  it("keeps the identity already set when --yes is given no choice, and asks nothing", async () => {
    identity.show.mockResolvedValue(NAMED);
    expect(await run("on", "--yes")).toBeNull();
    expect(turnOn).toHaveBeenCalledWith(process.cwd(), "keep");
    expect(select).not.toHaveBeenCalled();
    expect(propose).not.toHaveBeenCalled();
  });

  it("refuses --yes with no identity set and no choice, before anything is written", async () => {
    expect(await run("on", "--yes")).toBe(1);
    expect(turnOn).not.toHaveBeenCalled();
    expect(propose).not.toHaveBeenCalled();
    expect(ensureInstallationId).not.toHaveBeenCalled();
    expect(stderr()).toContain("--as <id>");
    expect(stderr()).toContain("--anonymous");
  });

  it("refuses --as with --anonymous, before asking anything", async () => {
    expect(await run("on", "--yes", "--as", "Ada Example", "--anonymous")).toBe(1);
    expect(identity.show).not.toHaveBeenCalled();
    expect(turnOn).not.toHaveBeenCalled();
  });

  it("refuses an identifier the identity rules refuse, before asking anything", async () => {
    expect(await run("on", "--yes", "--as", "a".repeat(129))).toBe(1);
    expect(confirm).not.toHaveBeenCalled();
    expect(turnOn).not.toHaveBeenCalled();
    expect(stderr()).toContain(
      "An identity is one non-empty line of at most 128 characters. Nothing was changed."
    );
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
      confirm.mockResolvedValue(true);
      propose.mockResolvedValue("Ada Example");
    });
    afterEach(() => {
      process.stdout.isTTY = original;
    });

    const choices = () => select.mock.calls[0]?.[1] as { name: string; value: unknown }[];
    const offered = () => choices().map((c) => c.value);

    it("turns on after a yes, defaulting the question to no", async () => {
      select.mockResolvedValue("none");
      expect(await run("on")).toBeNull();
      expect(confirm.mock.calls[0]?.[1]).toBe(false);
      expect(turnOn).toHaveBeenCalled();
    });

    it("changes nothing after a no, and reads no proposal", async () => {
      confirm.mockResolvedValue(false);
      expect(await run("on")).toBeNull();
      expect(turnOn).not.toHaveBeenCalled();
      expect(propose).not.toHaveBeenCalled();
      expect(stdout()).toContain("Nothing changed.");
    });

    it("offers the proposal, another identifier, or anonymity, and names the one chosen", async () => {
      select.mockImplementation(
        async (_message, choices: { value: unknown }[]) => choices[0]?.value
      );
      expect(await run("on")).toBeNull();
      expect(propose).toHaveBeenCalledWith(process.cwd());
      expect(offered()).toEqual([{ set: "Ada Example" }, "another", "none"]);
      expect(choices()[0]?.name).toContain("Ada Example");
      expect(turnOn).toHaveBeenCalledWith(process.cwd(), { set: "Ada Example" });
    });

    it("offers no proposal when there is none", async () => {
      propose.mockResolvedValue(null);
      select.mockResolvedValue("none");
      await run("on");
      expect(offered()).toEqual(["another", "none"]);
    });

    it("takes another identifier, typed", async () => {
      select.mockResolvedValue("another");
      input.mockResolvedValue("Ada at Work");
      expect(await run("on")).toBeNull();
      expect(input.mock.calls[0]?.[0]).toBe(
        "Identifier (one non-empty line, at most 128 characters):"
      );
      expect(turnOn).toHaveBeenCalledWith(process.cwd(), { set: "Ada at Work" });
    });

    it("asks again until the identifier typed is one it can keep", async () => {
      select.mockResolvedValue("another");
      input
        .mockResolvedValueOnce("   ")
        .mockResolvedValueOnce("a".repeat(129))
        .mockResolvedValueOnce("Ada at Work");
      expect(await run("on")).toBeNull();
      expect(input).toHaveBeenCalledTimes(3);
      expect(stderr().split("one non-empty line of at most 128 characters.")).toHaveLength(3);
      expect(stderr()).not.toContain("Nothing was changed.");
      expect(turnOn).toHaveBeenCalledTimes(1);
      expect(turnOn).toHaveBeenCalledWith(process.cwd(), { set: "Ada at Work" });
    });

    it("stays anonymous when chosen", async () => {
      select.mockResolvedValue("none");
      await run("on");
      expect(turnOn).toHaveBeenCalledWith(process.cwd(), "none");
    });

    it("asks nothing about the person when an identity is set", async () => {
      identity.show.mockResolvedValue(NAMED);
      expect(await run("on")).toBeNull();
      expect(select).not.toHaveBeenCalled();
      expect(propose).not.toHaveBeenCalled();
      expect(turnOn).toHaveBeenCalledWith(process.cwd(), "keep");
    });

    it("asks nothing about the person when a flag answered", async () => {
      expect(await run("on", "--anonymous")).toBeNull();
      expect(confirm).toHaveBeenCalled();
      expect(select).not.toHaveBeenCalled();
      expect(turnOn).toHaveBeenCalledWith(process.cwd(), "none");
    });
  });

  it("exits 1 when it is refused", async () => {
    turnOn.mockResolvedValue({ status: "refused", reason: "identity-set" });
    expect(await run("on", "--yes", "--anonymous")).toBe(1);
    expect(stderr()).toContain("aidd telemetry identity --off");
    expect(ensureInstallationId).not.toHaveBeenCalled();
  });

  it("reports that measurement is on if saving the installation ID fails afterward", async () => {
    ensureInstallationId.mockRejectedValueOnce(new Error("disk full"));
    expect(await run("on", "--yes", "--anonymous")).toBe(1);
    expect(turnOn).toHaveBeenCalled();
    expect(stderr()).toContain(
      "Measurement is on, but the installation ID could not be saved: disk full"
    );
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

describe("telemetry otel init", () => {
  it("refuses the production endpoint through the command without touching ledger wiring", async () => {
    expect(await run("otel", "init", "--config=codex", "--endpoint=prod")).toBe(1);
    expect(stderr()).toContain("Gouvernail");
    expect(turnOn).not.toHaveBeenCalled();
  });
});

describe("native telemetry commands", () => {
  let previousExitCode: typeof process.exitCode;

  beforeEach(() => {
    previousExitCode = process.exitCode;
  });

  afterEach(() => {
    process.exitCode = previousExitCode;
  });

  it("starts the local collector on its default or requested port", async () => {
    const collect = vi.spyOn(otel, "collectOtel").mockResolvedValue({
      port: 54321,
      close: async () => {},
    });
    expect(await run("otel", "collect")).toBeNull();
    expect(collect).toHaveBeenCalledWith(14318);
    expect(stdout()).toContain("OTLP collector listening on http://127.0.0.1:54321");
    expect(await run("otel", "collect", "--port=0")).toBeNull();
    expect(collect).toHaveBeenLastCalledWith(0);
  });

  it("rejects malformed collector ports and reports binding failures", async () => {
    const collect = vi.spyOn(otel, "collectOtel").mockRejectedValue(new Error("port in use"));
    for (const value of ["abc", "prefix42", "42suffix"]) {
      expect(await run("otel", "collect", `--port=${value}`)).toBe(1);
      expect(stderr()).toContain("Collector port must be an integer");
    }
    expect(collect).not.toHaveBeenCalled();
    expect(await run("otel", "collect", "--port=42")).toBe(1);
    expect(stderr()).toContain("port in use");
  });

  it("reports a new exporter, then reports the same configuration unchanged", async () => {
    const configure = vi
      .spyOn(otel, "configureOtel")
      .mockResolvedValueOnce({
        path: "/config/claude",
        launch: "Restart Claude Code",
        changed: true,
      })
      .mockResolvedValueOnce({
        path: "/config/claude",
        launch: "Restart Claude Code",
        changed: false,
      });
    const args = ["otel", "init", "--config=claude", "--endpoint=dev"];
    expect(await run(...args), stderr()).toBeNull();
    expect(stdout()).toContain("Updated ");
    expect(stdout()).toContain("Restart Claude Code");
    expect(stdout()).toContain(
      "Local OTLP capture may include prompts, responses, commands and tool output."
    );
    out = [];
    expect(await run(...args), stderr()).toBeNull();
    expect(stdout()).toContain("Already configured in ");
    expect(configure).toHaveBeenCalledTimes(2);
    expect(configure).toHaveBeenCalledWith("claude", "dev");
    expect(turnOn).not.toHaveBeenCalled();
  });

  it("reports capture counts without exposing their content, and fails when no capture exists", async () => {
    const check = vi
      .spyOn(otel, "checkOtel")
      .mockRejectedValueOnce(new Error("No OTLP capture found"))
      .mockResolvedValueOnce({
        path: "/config/claude",
        capture: "/capture/claude.jsonl",
        lines: 1,
        modifiedAt: "2026-11-04T00:00:00.000Z",
        observations: 1,
        eventLines: 0,
        unrecognisedLines: 0,
      });
    expect(await run("otel", "verify", "--config=claude", "--endpoint=dev")).toBe(1);
    expect(stderr()).toContain("No OTLP capture found");
    out = [];
    expect(await run("otel", "verify", "--config=claude", "--endpoint=dev")).toBeNull();
    expect(stdout()).toContain("Configuration verified in /config/claude");
    expect(stdout()).toContain("1 captured lines");
    expect(stdout()).toContain("1 normalized observations; 0 event lines; 0 unrecognised lines");
    expect(stdout()).toContain(
      "Existing capture does not prove delivery from the current session."
    );
    expect(check).toHaveBeenCalledWith("claude", "dev");
  });

  it("forwards the launched OpenCode exit code", async () => {
    const launch = vi
      .spyOn(otel, "launchOtel")
      .mockResolvedValueOnce(7)
      .mockRejectedValueOnce(new Error("Cannot launch OpenCode"));
    expect(await run("otel", "run", "--config=opencode", "--", "check")).toBeNull();
    expect(launch).toHaveBeenCalledWith(["check"]);
    expect(process.exitCode).toBe(7);
    expect(await run("otel", "run", "--config=opencode", "--", "check")).toBe(1);
    expect(stderr()).toContain("Cannot launch OpenCode");
  });

  it("forwards one consented session without printing its token", async () => {
    vi.stubEnv("AIDD_OTEL_TOKEN", "private-test-token");
    const admission = { feature: { state: "unbound" }, cwd: "/project", repositoryId: "repo" };
    sessionSnapshot.mockResolvedValue(new Map([["s1", admission]]));
    sessionPermits.mockResolvedValueOnce("allow").mockResolvedValueOnce("deny");
    const sync = vi.spyOn(otel, "syncCapturedSession").mockResolvedValue({
      sent: 2,
      skipped: 0,
      offset: 12,
      partialLine: true,
    });
    expect(
      await run(
        "otel",
        "sync",
        "--config=claude",
        "--session=s1",
        "--tenant=acme",
        "--endpoint=http://127.0.0.1:3000"
      )
    ).toBeNull();
    expect(sessionSnapshot).toHaveBeenCalledWith("claude-code");
    const call = sync.mock.calls[0];
    if (!call) throw new Error("the session was not passed to the exporter");
    expect(call[0]).toMatchObject({
      config: "claude",
      session: "s1",
      tenant: "acme",
      endpoint: "http://127.0.0.1:3000",
      token: "private-test-token",
      follow: false,
    });
    expect(await call[1]()).toEqual({ state: "unbound" });
    const transfer = { signal: "logs" as const, payload: {}, at: "2026-11-04T00:00:00Z" };
    expect(await call[2](transfer)).toBe(true);
    expect(await call[2](transfer)).toBe(false);
    expect(await call[2]({ signal: "logs", payload: {} })).toBe(false);
    expect(stdout()).toContain("Sent 2 observations");
    expect(stdout()).toContain("last incomplete capture line");
    expect(stdout()).not.toContain("private-test-token");
  });

  it("never sends a session that lacks consent", async () => {
    sessionSnapshot.mockResolvedValue(new Map());
    const sync = vi.spyOn(otel, "syncCapturedSession");
    expect(
      await run(
        "otel",
        "sync",
        "--config=codex",
        "--session=s2",
        "--tenant=acme",
        "--endpoint=http://127.0.0.1:3000"
      )
    ).toBe(1);
    expect(sessionSnapshot).toHaveBeenCalledWith("codex");
    expect(stderr()).toContain("No consented usage found");
    expect(sync).not.toHaveBeenCalled();
  });

  it("stops admitting events when a followed session loses consent", async () => {
    vi.stubEnv("AIDD_OTEL_TOKEN", "");
    const admission = { feature: { state: "unbound" }, cwd: "/project", repositoryId: "repo" };
    sessionSnapshot
      .mockResolvedValueOnce(new Map([["s1", admission]]))
      .mockResolvedValueOnce(new Map([["s1", admission]]))
      .mockResolvedValueOnce(new Map());
    sessionPermits.mockResolvedValue("allow");
    const sync = vi.spyOn(otel, "syncCapturedSession").mockResolvedValue({
      sent: 1,
      skipped: 0,
      offset: 1,
      partialLine: false,
    });
    expect(
      await run(
        "otel",
        "sync",
        "--config=codex",
        "--session=s1",
        "--tenant=acme",
        "--endpoint=http://127.0.0.1:3000",
        "--follow"
      )
    ).toBeNull();
    expect(stdout()).toContain("Following the selected session");
    expect(stdout()).not.toContain("last incomplete capture line");
    const call = sync.mock.calls[0];
    if (!call) throw new Error("the session was not passed to the exporter");
    expect(call[0]).toMatchObject({ follow: true, token: "" });
    await expect(call[1]()).rejects.toThrow("No consented usage found");
    expect(await call[2]({ signal: "logs", payload: {}, at: "2026-11-04T00:00:00Z" })).toBe(false);
  });

  it("requires a session for one-shot sync and discovers sessions only with follow", async () => {
    vi.stubEnv("AIDD_OTEL_TOKEN", "private-test-token");
    const follow = vi
      .spyOn(otel, "followCapturedSessions")
      .mockResolvedValue({ sent: 3, denied: 1, pending: 2 });
    const args = [
      "otel",
      "sync",
      "--config=codex",
      "--tenant=acme",
      "--endpoint=http://127.0.0.1:3000",
    ];
    expect(await run(...args)).toBeNull();
    expect(process.exitCode).toBe(1);
    expect(stderr()).toContain("Pass --session");
    expect(follow).not.toHaveBeenCalled();
    process.exitCode = previousExitCode;
    sessionSnapshot.mockResolvedValue(new Map());
    sessionPermits.mockResolvedValue("unknown");
    expect(await run(...args, "--follow")).toBeNull();
    const call = follow.mock.calls[0];
    if (!call) throw new Error("the session follower was not started");
    expect(call[0]).toMatchObject({ config: "codex", tenant: "acme", token: "private-test-token" });
    expect(await call[1]()).toEqual(new Map());
    const admission = {
      feature: { state: "unbound" as const },
      cwd: "/project",
      repositoryId: "repo",
    };
    expect(await call[2](admission, "2026-11-04T00:00:00Z")).toBe("unknown");
    expect(stdout()).toContain("Sent 3 observations; 1 were outside consent; 2 await confirmation");
    expect(stdout()).not.toContain("private-test-token");
  });
});
