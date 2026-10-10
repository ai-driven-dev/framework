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
  report: {
    axis: "task",
    rows: [
      { value: { kind: "value", value: "checkout" }, ...tally(1, 0) },
      { value: { kind: "unattributed", reason: "no-binding" }, ...tally(2, 1) },
      { value: { kind: "absent" }, ...tally(1, 0) },
    ],
    totals: tally(4, 1),
  },
  coverage: {
    filesRead: 3,
    records: 4,
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
    skippedLedgerLines: 0,
  },
};

describe("the JSON envelope of a report", () => {
  it("carries its version first, and the period and axis it answers", () => {
    const envelope = reportEnvelopeOf(reported);
    expect(Object.keys(envelope)[0]).toBe("version");
    expect(envelope).toMatchObject({
      version: 1,
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

  it("states the totals and how many records had an unknown counter", () => {
    const envelope = reportEnvelopeOf(reported);
    expect(envelope.totals).toMatchObject({
      records: 4,
      total: { tokens: 10, unknown_records: 1 },
    });
    expect(envelope.unknown_records).toBe(1);
  });

  it("states the coverage in snake case, and nothing about where the data lives", () => {
    const envelope = reportEnvelopeOf(reported);
    expect(envelope.coverage).toEqual({
      files_read: 3,
      records: 4,
      unrecognised_shapes: 1,
      not_stored: reported.coverage.notStored,
      consent_log_damaged: false,
      oldest_transcript_at: "2026-09-20T08:00:00.000Z",
      skipped_ledger_lines: 0,
    });
  });

  it("is versioned when nothing was read under AIDD_TELEMETRY=0", () => {
    expect(REFUSED_ENVELOPE).toEqual({ version: 1, refused: "AIDD_TELEMETRY=0" });
  });
});
