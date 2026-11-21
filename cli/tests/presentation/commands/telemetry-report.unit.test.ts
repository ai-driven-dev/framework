import { describe, expect, it, vi } from "vitest";
import type { ReportFilters } from "../../../src/contexts/telemetry/contract/report-filter.js";
import { conflictsOf } from "../../../src/contexts/telemetry/domain/report/report-filter.js";
import {
  installTelemetryIo,
  NO_FILTERS,
  report,
  reported,
  run,
  stderr,
  stdout,
} from "../../shared/testing/telemetry-command.builder.js";

installTelemetryIo();

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
    const [[{ period }]] = report.mock.calls;
    expect(period.from).toBe(period.to);
  });

  it("refuses --days together with --from, and a bad day, before reading anything", async () => {
    expect(await run("report", "--days", "3", "--from", "2026-10-01")).toBe(1);
    expect(stderr()).toContain("--days cannot be combined");
    expect(await run("report", "--from", "yesterday")).toBe(1);
    expect(report).not.toHaveBeenCalled();
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
  const asked = () => report.mock.calls[0]?.[0].filters;
  /** Commander refuses a flag value itself: with `exitOverride` it throws its exit code. */
  async function refused(...args: string[]): Promise<number> {
    try {
      const code = await run("report", ...args);
      if (code === null) throw new Error("not refused");
      return code;
    } catch (error) {
      if (error instanceof Error && "exitCode" in error) return Number(error.exitCode);
      throw error;
    }
  }

  it("passes every flag it is given", async () => {
    report.mockResolvedValue(reported);
    await run(
      "report",
      ...["--task", "auth refactor", "--ticket", "PROJ-1", "--person", "p-1"],
      ...["--model", "m-1", "--agent", "subagent", "--session", "a1b2", "--repository", "r-1"],
      ...["--tool", "codex"]
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
    await run("report", "--absent", "person");
    expect(asked()).toEqual({ ...NO_FILTERS, absent: "person" });
  });

  it("asks for the repository the command runs in for `.`", async () => {
    report.mockResolvedValue(reported);
    await run("report", "--repository", ".");
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

  const twice = (flag: string) => `error: ${flag} is given twice: give it once.\n`;
  const notAllowed = (flags: string, value: string, allowed: string) =>
    `error: option '${flags}' argument '${value}' is invalid. Allowed choices are ${allowed}.\n`;
  it.each([
    ["an open flag given twice", ["--task", "a", "--task", "b"], twice("--task")],
    ["a closed flag given twice", ["--agent", "main", "--agent", "main"], twice("--agent")],
    ["a bare flag given twice", ["--unattributed", "--unattributed"], twice("--unattributed")],
    [
      "an agent no call can have",
      ["--agent", "robot"],
      notAllowed("--agent <agent>", "robot", "main, subagent, advisor"),
    ],
    [
      "a tool no call can have",
      ["--tool", "robot"],
      notAllowed("--tool <tool>", "robot", "claude-code, codex"),
    ],
    ["a tool given twice", ["--tool", "codex", "--tool", "codex"], twice("--tool")],
    [
      "an axis no call lacks",
      ["--absent", "session"],
      notAllowed("--absent <axis>", "session", "person, model, ticket"),
    ],
    [
      "a reason no call has",
      ["--unattributed", "no-task"],
      notAllowed("--unattributed [reason]", "no-task", "no-binding, declared-none, any"),
    ],
  ])("refuses %s with exit 1, saying why, before reading anything", async (_, args, message) => {
    expect(await refused(...args)).toBe(1);
    expect(stderr()).toBe(message);
    expect(report).not.toHaveBeenCalled();
  });

  it.each([
    [["--unattributed", "--task", "a"], "--task and --unattributed"],
    [["--ticket", "T", "--unattributed", "no-binding"], "--ticket and --unattributed"],
    [["--absent", "ticket", "--unattributed"], "--absent ticket and --unattributed"],
    [["--model", "m", "--absent", "model"], "--model and --absent model"],
  ])(
    "exits 1 on %j, which select on one axis, naming both as the report refuses them",
    async (args, flags) => {
      // The use case's own refusal, as `report-usage.unit.test.ts` pins it.
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
