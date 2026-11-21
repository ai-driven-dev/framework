import { describe, expect, it } from "vitest";
import type { Period } from "../../../../src/contexts/telemetry/contract/period.js";
import {
  NO_FILTERS,
  type ReportFilters,
} from "../../../../src/contexts/telemetry/contract/report-filter.js";
import { printUsageReport } from "../../../../src/presentation/display/telemetry/telemetry-report-display.js";
import { CapturingOutput } from "../../../shared/testing/capturing-output.fake.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import {
  BOTH,
  NOT_STORED,
  one,
  printed,
  result,
  tally,
  value,
} from "../../../shared/testing/usage-report-print.builder.js";

const UNRECOGNISED =
  " not recognised by this read: a call missing a counter is kept with that counter unknown; a line that is no usage line is never a call.";

describe("printing a usage report", () => {
  it("says they when several calls had an unknown counter", () => {
    const partial = tally(3, [1, 1, 5, 1], 2);
    expect(printed(result("total", [[value("total"), partial]], partial)).at(-3)).toBe(
      "2 calls had an unknown counter: they are left out of the sums marked +?, never counted as zero."
    );
  });

  it("names the period whichever of its ends are open", () => {
    const head = (period: Period) =>
      printed(result("total", [], tally(0, [0, 0, 0, 0]), {}, period))[0];
    expect(head({ from: "2026-10-01", to: "2026-10-07" })).toBe(
      "Usage, 2026-10-01 to 2026-10-07, by total"
    );
    expect(head({ from: "2026-10-01", to: null })).toBe("Usage, since 2026-10-01, by total");
    expect(head({ from: null, to: "2026-10-07" })).toBe("Usage, until 2026-10-07, by total");
    expect(head({ from: null, to: null })).toBe("Usage, all days, by total");
  });

  it("says so when the period holds no call, and still shows the coverage", () => {
    expect(
      printed(
        result("total", [], tally(0, [0, 0, 0, 0]), {
          filesRead: 1,
          records: 0,
          oldestTranscriptAt: null,
        })
      )
    ).toEqual([
      "Usage, 2026-10-01 to 2026-10-07, by total",
      "No calls in this period.",
      "",
      "Read 1 transcript just now; 0 calls in this period; oldest transcript on disk: none.",
    ]);
  });

  it("lists what was read and not stored, by reason, and what was not recognised", () => {
    const lines = printed(
      result("total", [], tally(0, [0, 0, 0, 0]), {
        records: 1,
        notStored: { ...NOT_STORED, "outside-repo": 2, "never-seen-alive": 1 },
        unrecognised: 3,
      })
    );
    expect(lines.slice(3)).toEqual([
      "Read 2 transcripts just now; 1 call in this period; oldest transcript on disk: 2026-09-20.",
      `3 shapes${UNRECOGNISED}`,
      "Not stored by this read: 2 calls outside any repository.",
      "Not stored by this read: 1 call from a directory never seen while it existed.",
    ]);
    const one_ = printed(result("total", [], tally(0, [0, 0, 0, 0]), { unrecognised: 1 }));
    expect(one_).toContain(`1 shape${UNRECOGNISED}`);
  });

  it("says when ledger lines are not records, and kept", () => {
    const lines = printed(result("total", [], tally(0, [0, 0, 0, 0]), { skippedLedgerLines: 2 }));
    expect(lines.at(-1)).toBe("2 ledger lines are not a record, kept as found.");
    expect(
      printed(result("total", [], tally(0, [0, 0, 0, 0]), { skippedLedgerLines: 1 })).at(-1)
    ).toBe("1 ledger line is not a record, kept as found.");
    expect(printed(result("total", [], tally(0, [0, 0, 0, 0]))).join("\n")).not.toContain("ledger");
  });

  it("says what every read kept of what it measured and could not store, and nothing when none", () => {
    const lines = printed(
      result("total", [], tally(0, [0, 0, 0, 0]), {
        leftOut: { undated: 1, unrecognised: 1_200, requestless: 3 },
      })
    );
    expect(lines.slice(-3)).toEqual([
      "Kept from every read: 1,200 lines that are no usage line.",
      "Kept from every read: 1 call with no usable time.",
      "Kept from every read: 3 calls with no request id.",
    ]);
    expect(printed(result("total", [], tally(0, [0, 0, 0, 0]))).join("\n")).not.toContain("Kept");
    expect(
      printed(
        result("total", [], tally(0, [0, 0, 0, 0]), {
          leftOut: { undated: 2, unrecognised: 1, requestless: 1 },
        })
      ).slice(-3)
    ).toEqual([
      "Kept from every read: 1 line that is no usage line.",
      "Kept from every read: 2 calls with no usable time.",
      "Kept from every read: 1 call with no request id.",
    ]);
  });

  it("warns on every report while the consent log is damaged, and not otherwise", () => {
    const damaged = { consentLogDamaged: true };
    for (let run = 0; run < 2; run += 1) {
      const lines = printed(result("total", [], tally(0, [0, 0, 0, 0]), damaged));
      expect(lines.at(-1)).toContain("`aidd telemetry forget --yes`, then `aidd telemetry on`");
    }
    expect(printed(result("total", [], tally(0, [0, 0, 0, 0]))).join("\n")).not.toContain(
      "consents.jsonl"
    );
  });

  it("says nothing was read under AIDD_TELEMETRY=0", () => {
    const output = new CapturingOutput(false);
    printUsageReport(output, { status: "refused" });
    expect(output.lines).toEqual(["AIDD_TELEMETRY=0: nothing was read and nothing is reported."]);
  });

  it("names the flag and every id a start names, in full, when it names several", () => {
    const output = new CapturingOutput(false);
    printUsageReport(output, {
      status: "ambiguous",
      flag: "session",
      typed: "a1b2",
      ids: ["a1b2c3d4-0000", "a1b2ffff-0000"],
    });
    expect(output.at("error")).toEqual([
      "--session a1b2 starts 2 sessions of this period: a1b2c3d4-0000, a1b2ffff-0000. Type more of it.",
    ]);
    expect(output.lines).toHaveLength(1);
    const repositories = new CapturingOutput(false);
    printUsageReport(repositories, {
      status: "ambiguous",
      flag: "repository",
      typed: "ab",
      ids: ["abc", "abd"],
    });
    expect(repositories.at("error")).toEqual([
      "--repository ab starts 2 repositories of this period: abc, abd. Type more of it.",
    ]);
  });

  it("names the two flags that select on one axis, with the axis --absent names", () => {
    const output = new CapturingOutput(false);
    printUsageReport(output, {
      status: "conflicting",
      flags: ["ticket", "absent"],
      absent: "ticket",
    });
    expect(output.at("error")).toEqual([
      "--ticket and --absent ticket select on the same axis, so together they keep nothing: give one of them.",
    ]);
    expect(output.lines).toHaveLength(1);
  });

  it("says `.` names no repository where the command runs", () => {
    const output = new CapturingOutput(false);
    printUsageReport(output, { status: "not-a-repository" });
    expect(output.at("error")).toEqual([
      "--repository . names the repository this directory is in, and it is in none: not a git repository, unreadable, or with neither an origin nor a commit.",
    ]);
    expect(output.lines).toHaveLength(1);
  });

  it("names each filter as its row would label it, on one line before the table", () => {
    const filters: ReportFilters = {
      ...NO_FILTERS,
      task: "auth\nrefactor",
      ticket: "PROJ-1",
      session: "a1b2c3d4-0000-4000-8000-000000000001",
      repository: "f".repeat(64),
      agent: "subagent",
      tool: TOOL.codex,
      absent: "model",
      person: "p-1",
    };
    const lines = printed(result("day", [[value("2026-10-02"), one]], one, {}, BOTH, filters));
    expect(lines.slice(0, 3)).toEqual([
      "Usage, 2026-10-01 to 2026-10-07, by day",
      "Selected: task = auth refactor, ticket = PROJ-1, person = p-1, agent = subagent, session = a1b2c3d4, repository = ffffffff, tool = codex, model = unknown model",
      "",
    ]);
    const absentOf = (absent: ReportFilters["absent"]) =>
      printed(result("total", [], one, {}, BOTH, { ...NO_FILTERS, absent }))[1];
    expect(absentOf("person")).toBe("Selected: person = anonymous");
    expect(absentOf("ticket")).toBe("Selected: ticket = no ticket");
    const unattributed = (reason: ReportFilters["unattributed"]) =>
      printed(result("total", [], one, {}, BOTH, { ...NO_FILTERS, unattributed: reason }))[1];
    expect(unattributed("no-binding")).toBe("Selected: task = unattributed: no task declared");
    expect(unattributed("declared-none")).toBe("Selected: task = unattributed: declared no task");
    expect(unattributed("any")).toBe("Selected: task = unattributed, either reason");
  });

  it("prints no selection line when no filter is given", () => {
    expect(printed(result("total", [[value("total"), one]], one))[1]).toBe("");
  });

  it("says no call matches when filters keep none, and still shows the coverage", () => {
    const filters = { ...NO_FILTERS, task: "nothing" };
    expect(printed(result("total", [], tally(0, [0, 0, 0, 0]), {}, BOTH, filters))).toEqual([
      "Usage, 2026-10-01 to 2026-10-07, by total",
      "Selected: task = nothing",
      "No call in this period matches these filters.",
      "",
      "Read 2 transcripts just now; 3 calls in this period; oldest transcript on disk: 2026-09-20.",
    ]);
  });
});
