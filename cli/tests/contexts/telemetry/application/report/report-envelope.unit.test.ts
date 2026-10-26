import { describe, expect, it } from "vitest";
import {
  REFUSED_ENVELOPE,
  reportEnvelopeOf,
} from "../../../../../src/contexts/telemetry/application/report/report-envelope.js";
import type { ReportResult } from "../../../../../src/contexts/telemetry/application/report/report-usage-use-case.js";
import type { Tally } from "../../../../../src/contexts/telemetry/domain/report/usage-report.js";

const tally = (records: number, unknown: number): Tally => ({
  records,
  counters: {
    input: { known: 1, unknownRecords: 0 },
    output: { known: 2, unknownRecords: 0 },
    cache_read: { known: 3, unknownRecords: unknown },
    cache_write: { known: 4, unknownRecords: 0 },
  },
  total: { known: 10, unknownRecords: unknown },
});
const reported: Extract<ReportResult, { status: "reported" }> = {
  status: "reported",
  period: { from: "2026-10-01", to: null },
  // Given out of order: the envelope prints its own order, whatever the object's.
  filters: {
    tool: "codex",
    unattributed: null,
    absent: "model",
    repository: "r".repeat(64),
    session: null,
    agent: "subagent",
    model: null,
    person: null,
    ticket: null,
    task: "checkout",
  },
  report: {
    axis: "task",
    rows: [
      { value: { kind: "value", value: "checkout" }, ...tally(1, 0) },
      { value: { kind: "unattributed", reason: "no-binding" }, ...tally(2, 1) },
      { value: { kind: "absent" }, ...tally(1, 0) },
    ],
    totals: tally(4, 1),
  },
  coverage: { records: 4, leftOut: { undated: 2, unrecognised: 5, requestless: 1 } },
  run: {
    filesRead: 3,
    unrecognised: 1,
    notStored: {
      "outside-repo": 0,
      "never-seen-alive": 2,
      "no-consent": 0,
      "consent-closed": 0,
      "unreadable-consent": 0,
      "no-cwd": 0,
      undated: 0,
    },
    consentLogDamaged: false,
    oldestTranscriptAt: "2026-09-20T08:00:00.000Z",
    skippedLedgerLines: 6,
  },
};

describe("the JSON envelope of a report", () => {
  it("carries its version first, and the period and axis it answers", () => {
    const envelope = reportEnvelopeOf(reported);
    expect(Object.keys(envelope)[0]).toBe("version");
    expect(envelope).toMatchObject({
      version: 2,
      period: { from: "2026-10-01", to: null },
      axis: "task",
    });
  });

  it("names each row by its kind, its key and its reason, with the four counters apart", () => {
    const { rows } = reportEnvelopeOf(reported);
    expect(rows[0]).toEqual({
      kind: "value",
      key: "checkout",
      reason: null,
      records: 1,
      input: { tokens: 1, unknown_records: 0 },
      output: { tokens: 2, unknown_records: 0 },
      cache_read: { tokens: 3, unknown_records: 0 },
      cache_write: { tokens: 4, unknown_records: 0 },
      total: { tokens: 10, unknown_records: 0 },
    });
    expect(rows[1]).toMatchObject({ kind: "unattributed", key: null, reason: "no-binding" });
    expect(rows[2]).toMatchObject({ kind: "absent", key: null, reason: null });
  });

  it("states how many records had an unknown counter once, in the totals", () => {
    const envelope = reportEnvelopeOf(reported);
    expect(envelope.totals).toMatchObject({
      records: 4,
      total: { tokens: 10, unknown_records: 1 },
    });
    expect(envelope).not.toHaveProperty("unknown_records");
  });

  it("states what the figures rest on, in snake case, and nothing about where the data lives", () => {
    const envelope = reportEnvelopeOf(reported);
    expect(envelope.coverage).toStrictEqual({
      records: 4,
      left_out: { undated: 2, unrecognised: 5, requestless: 1 },
    });
  });

  it("puts what the read that printed it found apart, last, so the rest is the figures", () => {
    const envelope = reportEnvelopeOf(reported);
    expect(Object.keys(envelope)).toEqual([
      "version",
      "period",
      "axis",
      "filters",
      "rows",
      "totals",
      "coverage",
      "run",
    ]);
    expect(envelope.run).toStrictEqual({
      files_read: 3,
      unrecognised_shapes: 1,
      not_stored: reported.run.notStored,
      consent_log_damaged: false,
      oldest_transcript_at: "2026-09-20T08:00:00.000Z",
      skipped_ledger_lines: 6,
    });
  });

  it("names what the report was narrowed to, every flag in a fixed order, as resolved", () => {
    const envelope = reportEnvelopeOf(reported);
    expect(Object.keys(envelope).slice(0, 4)).toEqual(["version", "period", "axis", "filters"]);
    expect(Object.entries(envelope.filters)).toEqual([
      ["task", "checkout"],
      ["ticket", null],
      ["person", null],
      ["model", null],
      ["agent", "subagent"],
      ["session", null],
      ["repository", "r".repeat(64)],
      ["absent", "model"],
      ["unattributed", null],
      ["tool", "codex"],
    ]);
  });

  it("is versioned when nothing was read under AIDD_TELEMETRY=0", () => {
    expect(REFUSED_ENVELOPE).toEqual({ version: 2, refused: "AIDD_TELEMETRY=0" });
  });
});
