import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { SessionDeclaration } from "../../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import {
  type Attribution,
  type AttributionFacts,
  attribute,
} from "../../../../../src/contexts/telemetry/domain/report/attribution.js";
import {
  conflictsOf,
  matchesFilter,
  NO_FILTERS,
  type ReportFilters,
  resolveId,
} from "../../../../../src/contexts/telemetry/domain/report/report-filter.js";
import {
  type AxisValue,
  buildReport,
  REPORT_AXES,
  type ReportAxis,
} from "../../../../../src/contexts/telemetry/domain/report/usage-report.js";
import type { StoredUsage } from "../../../../../src/contexts/telemetry/domain/stored-usage.js";
import {
  USAGE_AGENTS,
  USAGE_TOOLS,
} from "../../../../../src/contexts/telemetry/domain/usage-record.js";

const call = (over: Partial<StoredUsage> = {}): StoredUsage => ({
  tool: "claude-code",
  tool_version: null,
  key: "k",
  session_id: "s-1",
  agent: "main",
  at: "2026-10-02T10:00:00.000Z",
  model: "m-1",
  input: 1,
  output: 10,
  cache_read: 100,
  cache_write: 1000,
  cache_write_1h: null,
  reasoning: null,
  cwd: null,
  git_branch: null,
  repository_id: "repo-a",
  ...over,
});
const on = (task: string, ticket: string | null = null): Attribution => ({
  state: "attributed",
  task,
  ticket,
});
const NO_BINDING: Attribution = { state: "unattributed", reason: "no-binding" };
const DECLARED_NONE: Attribution = { state: "unattributed", reason: "declared-none" };
const only = (over: Partial<ReportFilters>): ReportFilters => ({ ...NO_FILTERS, ...over });
const keeps = (
  over: Partial<ReportFilters>,
  record = call(),
  attribution: Attribution = on("t-1", "T-1"),
  person: string | null = "p-1"
) => matchesFilter(only(over), record, attribution, person);

describe("a filter", () => {
  it("keeps every call when no flag is given", () => {
    expect(keeps({})).toBe(true);
    expect(keeps({}, call({ model: null }), NO_BINDING, null)).toBe(true);
  });

  it("keeps a call whose axis has exactly the value named, case and all", () => {
    expect(keeps({ task: "t-1" })).toBe(true);
    expect(keeps({ task: "T-1" })).toBe(false);
    expect(keeps({ ticket: "T-1" })).toBe(true);
    expect(keeps({ ticket: "T-2" })).toBe(false);
    expect(keeps({ person: "p-1" })).toBe(true);
    expect(keeps({ person: "p-1" }, call(), on("t-1"), null)).toBe(false);
    expect(keeps({ model: "m-1" })).toBe(true);
    expect(keeps({ model: "m-2" })).toBe(false);
    expect(keeps({ agent: "main" })).toBe(true);
    expect(keeps({ agent: "subagent" })).toBe(false);
    expect(keeps({ tool: "claude-code" })).toBe(true);
    expect(keeps({ tool: "codex" })).toBe(false);
    expect(keeps({ session: "s-1" })).toBe(true);
    expect(keeps({ session: "s-" })).toBe(false);
    expect(keeps({ repository: "repo-a" })).toBe(true);
    expect(keeps({ repository: "repo-b" })).toBe(false);
  });

  it("names no task or ticket of a call with no task by the reason's words", () => {
    expect(keeps({ task: "no-binding" }, call(), NO_BINDING)).toBe(false);
    expect(keeps({ ticket: "no-binding" }, call(), NO_BINDING)).toBe(false);
  });

  it("keeps a call the axis has no value for under --absent, and only that call", () => {
    expect(keeps({ absent: "model" }, call({ model: null }))).toBe(true);
    expect(keeps({ absent: "model" })).toBe(false);
    expect(keeps({ absent: "person" }, call(), on("t-1"), null)).toBe(true);
    expect(keeps({ absent: "person" })).toBe(false);
    expect(keeps({ absent: "ticket" }, call(), on("t-1"))).toBe(true);
    expect(keeps({ absent: "ticket" })).toBe(false);
    // Work with no task has no ticket either, but it is unattributed, not absent.
    expect(keeps({ absent: "ticket" }, call(), NO_BINDING)).toBe(false);
  });

  it("keeps work with no task by its reason, or by either under any", () => {
    expect(keeps({ unattributed: "no-binding" }, call(), NO_BINDING)).toBe(true);
    expect(keeps({ unattributed: "no-binding" }, call(), DECLARED_NONE)).toBe(false);
    expect(keeps({ unattributed: "declared-none" }, call(), DECLARED_NONE)).toBe(true);
    expect(keeps({ unattributed: "declared-none" }, call(), NO_BINDING)).toBe(false);
    expect(keeps({ unattributed: "any" }, call(), NO_BINDING)).toBe(true);
    expect(keeps({ unattributed: "any" }, call(), DECLARED_NONE)).toBe(true);
    expect(keeps({ unattributed: "any" })).toBe(false);
  });

  it("keeps a call only when every flag given keeps it", () => {
    expect(keeps({ task: "t-1", model: "m-1", agent: "main" })).toBe(true);
    expect(keeps({ task: "t-1", model: "m-2", agent: "main" })).toBe(false);
    expect(keeps({ task: "t-2", model: "m-1" })).toBe(false);
    expect(keeps({ task: "t-1", absent: "ticket" }, call(), on("t-1"))).toBe(true);
    expect(keeps({ task: "t-1", absent: "ticket" })).toBe(false);
    expect(keeps({ unattributed: "any", absent: "model" }, call({ model: null }), NO_BINDING)).toBe(
      true
    );
    expect(keeps({ unattributed: "any", absent: "model" }, call(), NO_BINDING)).toBe(false);
  });
});

describe("flags that select on one axis twice", () => {
  it("are --unattributed with --task, --ticket or --absent ticket", () => {
    expect(conflictsOf(only({ unattributed: "any", task: "t" }))).toEqual([
      ["task", "unattributed"],
    ]);
    expect(conflictsOf(only({ unattributed: "no-binding", ticket: "T" }))).toEqual([
      ["ticket", "unattributed"],
    ]);
    expect(conflictsOf(only({ unattributed: "any", absent: "ticket" }))).toEqual([
      ["absent", "unattributed"],
    ]);
  });

  it("are a value and --absent of the same axis", () => {
    expect(conflictsOf(only({ model: "m", absent: "model" }))).toEqual([["model", "absent"]]);
    expect(conflictsOf(only({ person: "p", absent: "person" }))).toEqual([["person", "absent"]]);
    expect(conflictsOf(only({ ticket: "T", absent: "ticket" }))).toEqual([["ticket", "absent"]]);
  });

  it("are none when each flag selects its own axis", () => {
    expect(conflictsOf(NO_FILTERS)).toEqual([]);
    expect(conflictsOf(only({ task: "t", ticket: "T" }))).toEqual([]);
    expect(conflictsOf(only({ task: "t", absent: "ticket" }))).toEqual([]);
    expect(conflictsOf(only({ unattributed: "any", absent: "model", model: null }))).toEqual([]);
    expect(
      conflictsOf(
        only({
          task: "t",
          ticket: "T",
          person: "p",
          model: "m",
          agent: "main",
          session: "s",
          repository: "r",
        })
      )
    ).toEqual([]);
  });

  it("lists every pair, each in the order the flags are printed", () => {
    expect(
      conflictsOf(only({ task: "t", ticket: "T", absent: "ticket", unattributed: "any" }))
    ).toEqual([
      ["task", "unattributed"],
      ["ticket", "absent"],
      ["ticket", "unattributed"],
      ["absent", "unattributed"],
    ]);
  });
});

describe("an id typed in full or as a prefix", () => {
  const short = "a".repeat(40);
  const long = `${"a".repeat(40)}${"b".repeat(24)}`;

  it("is the value equal to it, even when it also starts another", () => {
    expect(resolveId(short, [long, short])).toEqual({ kind: "found", id: short });
  });

  it("is the one value it starts", () => {
    expect(resolveId("aaaa", [long, "c0ffee"])).toEqual({ kind: "found", id: long });
  });

  it("is ambiguous when it starts two or more, listing them in full and sorted", () => {
    expect(resolveId("ab", ["abd", "abc", "xyz", "abc"])).toEqual({
      kind: "ambiguous",
      ids: ["abc", "abd"],
    });
  });

  it("is none when it starts nothing, case included", () => {
    expect(resolveId("AB", ["abc"])).toEqual({ kind: "none" });
    expect(resolveId("abc", [])).toEqual({ kind: "none" });
  });
});

const SESSIONS = ["s-a", "s-b", "s-c"];
const instant = fc
  .integer({ min: 0, max: 3 * 86_400_000 })
  .map((ms) => new Date(Date.parse("2026-10-01T00:00:00.000Z") + ms).toISOString());
const usage = fc
  .record({
    key: fc.uuid(),
    session_id: fc.constantFrom(...SESSIONS),
    repository_id: fc.constantFrom("r-a", "r-b"),
    agent: fc.constantFrom(...USAGE_AGENTS),
    tool: fc.constantFrom(...USAGE_TOOLS),
    model: fc.option(fc.constantFrom("m-1", "m-2"), { nil: null }),
    at: instant,
    input: fc.option(fc.nat(1000), { nil: null, freq: 4 }),
    output: fc.nat(1000),
  })
  .map(
    (r): StoredUsage => ({
      ...r,
      tool_version: null,
      cache_read: 0,
      cache_write: 0,
      cache_write_1h: null,
      reasoning: null,
      cwd: null,
      git_branch: null,
    })
  );
const facts = fc
  .array(
    fc.record({
      session_id: fc.constantFrom(...SESSIONS),
      task: fc.constantFrom("t-1", "t-2", null),
      ticket: fc.option(fc.constantFrom("T-1", "T-2"), { nil: null }),
      declared_at: instant,
    }),
    { maxLength: 5 }
  )
  .map(
    (declarations): AttributionFacts => ({
      declarations: declarations.map(
        (d): SessionDeclaration => ({ ...d, none: d.task === null, by: "command" })
      ),
      carries: [],
      branches: new Map(),
    })
  );

/** The flags a person types to select one row: the row's own value, as the contract lists it. */
function filtersOfRow(axis: ReportAxis, value: AxisValue): ReportFilters {
  if (value.kind === "absent") return only({ absent: axis as ReportFilters["absent"] });
  if (value.kind === "unattributed") return only({ unattributed: value.reason });
  return only({ [axis]: value.value });
}

describe("selecting a row", () => {
  it("keeps exactly the calls of that row, so it adds up to that row", () => {
    fc.assert(
      fc.property(
        fc.array(usage, { maxLength: 30 }),
        facts,
        fc.option(fc.constant("p-1"), { nil: null }),
        fc.constantFrom(...REPORT_AXES.filter((axis) => axis !== "total" && axis !== "day")),
        (records, held, person, axis) => {
          for (const row of buildReport(records, held, person, axis).rows) {
            const filters = filtersOfRow(axis, row.value);
            const kept = records.filter((record) =>
              matchesFilter(filters, record, attribute(record, held), person)
            );
            const { records: n, counters, total } = row;
            expect(buildReport(kept, held, person, "total").totals).toEqual({
              records: n,
              counters,
              total,
            });
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
