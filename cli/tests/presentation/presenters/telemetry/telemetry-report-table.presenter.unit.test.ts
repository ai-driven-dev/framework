import { describe, expect, it } from "vitest";
import {
  type AxisValue,
  REPORT_AXES,
  type ReportAxis,
  type Tally,
} from "../../../../src/contexts/telemetry/contract/usage-report.js";
import {
  one,
  printed,
  result,
  sum,
  tally,
  value,
} from "../../../shared/testing/usage-report-print.builder.js";

describe("the table of a usage report", () => {
  it("lays out the four counters apart, a row total, a total row, and the coverage", () => {
    expect(
      printed(
        result(
          "task",
          [
            [value("checkout"), tally(2, [3, 30, 3000, 300])],
            [{ kind: "unattributed", reason: "no-binding" }, one],
          ],
          tally(3, [4, 40, 4000, 400])
        )
      )
    ).toEqual([
      "Usage, 2026-10-01 to 2026-10-07, by task",
      "",
      "Task                            Input  Output  Cache read  Cache write  Total",
      "checkout                            3      30       3,000          300  3,333",
      "unattributed: no task declared      1      10       1,000          100  1,111",
      "Total                               4      40       4,000          400  4,444",
      "",
      "Read 2 transcripts just now; 3 calls in this period; oldest transcript on disk: 2026-09-20.",
    ]);
  });

  it("shows the whole once on the total axis, and a Total row under every other axis", () => {
    const whole = tally(1, [4, 40, 4000, 400]);
    const onTotal = printed(result("total", [[value("total"), whole]], whole));
    expect(onTotal.filter((line) => /^total\s/iu.test(line))).toHaveLength(1);
    expect(onTotal.slice(2, 4)).toHaveLength(2);
    expect(onTotal[4]).toBe("");
    for (const axis of REPORT_AXES.filter((a) => a !== "total")) {
      const lines = printed(result(axis, [[value("x"), whole]], whole));
      expect(lines.filter((line) => line.startsWith("Total"))).toHaveLength(1);
    }
  });

  it("groups thousands and leaves small numbers alone", () => {
    const big = tally(1, [999, 1000, 1234567, 12]);
    const lines = printed(result("total", [[value("total"), big]], big));
    expect(lines[3]).toBe("total     999   1,000   1,234,567           12  1,236,578");
  });

  it("words each unattributed reason", () => {
    const rows: [AxisValue, Tally][] = (["no-binding", "declared-none"] as const).map((reason) => [
      { kind: "unattributed", reason },
      one,
    ]);
    const lines = printed(result("task", rows, tally(2, [2, 20, 2000, 200])));
    expect(lines.slice(3, 5).map((line) => line.slice(0, 36).trimEnd())).toEqual([
      "unattributed: no task declared",
      "unattributed: declared no task",
    ]);
  });

  it("marks a counter some calls did not report, and one no call reported", () => {
    const partial = tally(2, [1, 1, 5, 1], 1);
    const lines = printed(result("total", [[value("total"), partial]], partial));
    expect(lines[3]).toBe("total       1       1         5+?            1    8+?");
    expect(lines.at(-3)).toBe(
      "1 call had an unknown counter: it is left out of the sums marked +?, never counted as zero."
    );
    const whole = tally(2, [1, 1, 0, 1], 2);
    expect(printed(result("total", [[value("total"), whole]], whole))[3]).toBe(
      "total       1       1     unknown            1    3+?"
    );
    const nothing: Tally = {
      records: 1,
      counters: {
        input: sum(0, 1),
        output: sum(0, 1),
        cache_read: sum(0, 1),
        cache_write: sum(0, 1),
      },
      total: sum(0, 1),
    };
    expect(printed(result("total", [[value("total"), nothing]], nothing))[3]).toBe(
      "total   unknown  unknown     unknown      unknown  unknown"
    );
  });

  it("names the title of each axis", () => {
    for (const axis of REPORT_AXES) {
      const title = axis === "total" ? "Period" : `${axis[0]?.toUpperCase()}${axis.slice(1)}`;
      expect(printed(result(axis, [[value("x"), one]], one))[2]?.startsWith(title)).toBe(true);
      expect(printed(result(axis, [[value("x"), one]], one))[0]).toContain(`by ${axis}`);
    }
  });

  it("says what an absent value is on each axis", () => {
    const labels: Record<ReportAxis, string> = {
      total: "all",
      person: "anonymous",
      session: "no session",
      model: "unknown model",
      agent: "no agent",
      tool: "no tool",
      day: "no day",
      repository: "no repository",
      task: "no task",
      ticket: "no ticket",
    };
    for (const axis of REPORT_AXES) {
      const lines = printed(result(axis, [[{ kind: "absent" }, one]], one));
      expect(lines[3]?.startsWith(labels[axis])).toBe(true);
    }
  });

  it("shows a session and a repository by their first eight characters only", () => {
    const long = "0123456789abcdef-long-id";
    for (const axis of ["session", "repository"] as const) {
      const lines = printed(result(axis, [[value(long), one]], one));
      expect(lines[3]?.startsWith("01234567  ")).toBe(true);
    }
    expect(printed(result("task", [[value(long), one]], one))[3]?.startsWith(long)).toBe(true);
  });

  it("keeps a task name to one line", () => {
    const lines = printed(result("task", [[value("  a\nb\u0007\t c  "), one]], one));
    expect(lines[3]?.startsWith("a b c  ")).toBe(true);
    expect(lines).toHaveLength(7);
  });
});
