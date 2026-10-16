import { describe, expect, it } from "vitest";
import { foldUsage } from "../../../../src/contexts/telemetry/domain/usage-fold.js";
import {
  type UsageRecord,
  usageTotal,
} from "../../../../src/contexts/telemetry/domain/usage-record.js";

function record(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    tool: "claude-code",
    tool_version: null,
    key: "msg_A:req_A",
    session_id: "s-1",
    agent: "main",
    at: "2026-10-07T10:00:00.000Z",
    model: "m",
    input: 1,
    output: 10,
    cache_read: 0,
    cache_write: 0,
    cache_write_1h: null,
    reasoning: null,
    cwd: null,
    git_branch: null,
    ...overrides,
  };
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest])
  );
}

describe("the global fold keeps one record per key", () => {
  it("keeps the record with the largest total", () => {
    const snapshots = [record({ output: 10 }), record({ output: 250 }), record({ output: 40 })];
    expect(foldUsage(snapshots).map((r) => r.output)).toEqual([250]);
  });

  it("breaks a tie on total by the earliest time", () => {
    const late = record({ at: "2026-10-07T10:00:09.000Z", session_id: "s-0" });
    const early = record({ at: "2026-10-07T10:00:01.000Z", session_id: "s-9" });
    expect(foldUsage([late, early]).map((r) => r.session_id)).toEqual(["s-9"]);
  });

  it("breaks a tie on total and time by the lowest session id", () => {
    const high = record({ session_id: "s-2" });
    const low = record({ session_id: "s-1" });
    expect(foldUsage([high, low]).map((r) => r.session_id)).toEqual(["s-1"]);
  });

  it("compares times as instants, not as text", () => {
    const early = record({ at: "2026-10-07T10:00:00.000Z", session_id: "s-9" });
    const late = record({ at: "2026-10-07T09:30:00.000-01:00", session_id: "s-0" });
    expect(foldUsage([late, early]).map((r) => r.session_id)).toEqual(["s-9"]);
  });

  it("gives the same records whatever the order of the input", () => {
    const input = [
      record({ output: 10, session_id: "s-1" }),
      record({ output: 250, session_id: "s-2", at: "2026-10-07T10:00:05.000Z" }),
      record({ output: 250, session_id: "s-3", at: "2026-10-07T10:00:03.000Z" }),
      record({ key: "msg_B:req_B", output: 5 }),
      record({ key: "msg_B:req_B#advisor0", agent: "advisor", output: 7 }),
    ];
    const expected = JSON.stringify(foldUsage(input));
    for (const order of permutations(input))
      expect(JSON.stringify(foldUsage(order))).toBe(expected);
    expect(foldUsage(input).map((r) => [r.key, r.session_id])).toEqual([
      ["msg_A:req_A", "s-3"],
      ["msg_B:req_B", "s-1"],
      ["msg_B:req_B#advisor0", "s-1"],
    ]);
  });

  it("picks the same record when only unranked fields differ, whatever the order", () => {
    const here = record({ cwd: "/a" });
    const there = record({ cwd: "/b" });
    expect(foldUsage([here, there])).toEqual(foldUsage([there, here]));
  });

  it("breaks a tie on time by text when a time does not parse", () => {
    const high = record({ at: "later", session_id: "s-1" });
    const low = record({ at: "earlier", session_id: "s-2" });
    expect(foldUsage([high, low]).map((r) => r.at)).toEqual(["earlier"]);
    expect(foldUsage([low, high]).map((r) => r.at)).toEqual(["earlier"]);
  });

  it("falls to the session id when two unparseable times are the same text", () => {
    const high = record({ at: "n/a", session_id: "s-2" });
    const low = record({ at: "n/a", session_id: "s-1" });
    expect(foldUsage([high, low]).map((r) => r.session_id)).toEqual(["s-1"]);
  });

  it("sums all four counters into the total", () => {
    expect(usageTotal(record({ input: 1, output: 2, cache_read: 4, cache_write: 8 }))).toBe(15);
  });

  it("keeps the same key of two tools apart", () => {
    const folded = foldUsage([record(), record({ tool: "codex" })]);
    expect(folded).toHaveLength(2);
  });

  it("counts an unknown counter as nothing in the total", () => {
    expect(usageTotal(record({ input: null, output: 4, cache_read: null, cache_write: 6 }))).toBe(
      10
    );
  });
});
