import { describe, expect, it } from "vitest";
import { AXES, CALLS, type Call, COUNTERS } from "../helpers/telemetry-report-seed.js";
import { aidd, declareBranch, held, json, useReportSandbox } from "./telemetry-report-sandbox.js";

useReportSandbox();

describe("aidd telemetry report", () => {
  it("answers on every axis, and every axis adds up to the same totals", async () => {
    await declareBranch();
    const known = (pick: (call: Call) => number | null) =>
      CALLS.reduce((n, call) => n + (pick(call) ?? 0), 0);
    const oracle = {
      input: known((c) => c.input),
      output: known((c) => c.output),
      cache_read: known((c) => c.read),
      cache_write: known((c) => c.write),
    };
    const sums: Record<string, number> = {};
    for (const axis of AXES) {
      const envelope = await json(axis);
      expect(envelope.version).toBe(2);
      expect(envelope.axis).toBe(axis);
      expect(envelope.totals.records).toBe(CALLS.length);
      expect(envelope.rows.reduce((n, row) => n + row.records, 0)).toBe(CALLS.length);
      for (const name of COUNTERS) {
        expect(envelope.totals[name].tokens, `${axis} ${name} total`).toBe(oracle[name]);
        expect(
          envelope.rows.reduce((n, row) => n + row[name].tokens, 0),
          `${axis} ${name}`
        ).toBe(oracle[name]);
      }
      expect(envelope.rows.reduce((n, row) => n + row.total.tokens, 0)).toBe(
        envelope.totals.total.tokens
      );
      expect(envelope.totals.total.unknown_records).toBe(1);
      expect(envelope.totals.cache_read.unknown_records).toBe(1);
      sums[axis] = envelope.totals.total.tokens;
    }
    expect(new Set(Object.values(sums)).size).toBe(1);
  });

  it("reads nothing under AIDD_TELEMETRY=0", async () => {
    const before = await held();
    const text = await aidd(["report"], { AIDD_TELEMETRY: "0" });
    expect(text.exitCode).toBe(0);
    expect(text.stdout).toContain("AIDD_TELEMETRY=0");
    const asJson = await aidd(["report", "--json"], { AIDD_TELEMETRY: "0" });
    expect(JSON.parse(asJson.stdout)).toEqual({ version: 2, refused: "AIDD_TELEMETRY=0" });
    expect(await held()).toEqual(before);
  });
});
