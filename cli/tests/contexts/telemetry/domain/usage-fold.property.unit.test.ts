import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { UsageRecord } from "../../../../src/contexts/telemetry/contract/usage-record.js";
import { foldUsage, usageTotal } from "../../../../src/contexts/telemetry/domain/usage-fold.js";

const START = Date.parse("2026-10-01T00:00:00.000Z");
const counter = fc.option(fc.integer({ min: 0, max: 3 }), { nil: null });

const call: fc.Arbitrary<UsageRecord> = fc.record({
  tool: fc.constantFrom("claude-code" as const, "codex" as const),
  tool_version: fc.constant(null),
  key: fc.constantFrom("k1", "k2", "k3"),
  session_id: fc.constantFrom("s1", "s2"),
  agent: fc.constantFrom("main" as const, "subagent" as const),
  at: fc.integer({ min: 0, max: 3_600_000 }).map((ms) => new Date(START + ms).toISOString()),
  model: fc.constant(null),
  input: counter,
  output: counter,
  cache_read: counter,
  cache_write: counter,
  cache_write_1h: fc.constant(null),
  reasoning: fc.constant(null),
  cwd: fc.constant(null),
  git_branch: fc.constant(null),
});

const calls = fc.array(call, { maxLength: 12 });
const identity = (record: UsageRecord) => `${record.tool}/${record.key}`;

describe("folding the copies of billed calls", () => {
  it("keeps exactly one record per tool and key", async () => {
    await fc.assert(
      fc.property(calls, (records) => {
        const kept = foldUsage(records).map(identity);

        expect(new Set(kept).size).toBe(kept.length);
        expect(new Set(kept)).toEqual(new Set(records.map(identity)));
      })
    );
  });

  it("keeps, of each call, a copy with the largest total", async () => {
    await fc.assert(
      fc.property(calls, (records) => {
        for (const winner of foldUsage(records)) {
          const copies = records.filter((record) => identity(record) === identity(winner));
          expect(usageTotal(winner)).toBe(Math.max(...copies.map(usageTotal)));
        }
      })
    );
  });

  it("gives the same records whatever order the copies arrive in", async () => {
    await fc.assert(
      fc.property(
        calls.chain((records) =>
          fc.tuple(
            fc.constant(records),
            fc.shuffledSubarray(records, { minLength: records.length, maxLength: records.length })
          )
        ),
        ([records, shuffled]) => {
          expect(foldUsage(shuffled)).toEqual(foldUsage(records));
        }
      )
    );
  });

  it("is settled once folded", async () => {
    await fc.assert(
      fc.property(calls, (records) => {
        const once = foldUsage(records);

        expect(foldUsage(once)).toEqual(once);
      })
    );
  });
});
