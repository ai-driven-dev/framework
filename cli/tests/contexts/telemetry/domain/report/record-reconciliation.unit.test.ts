import { describe, expect, it } from "vitest";
import {
  collapseBilledRequests,
  collapseSupersededTurns,
} from "../../../../../src/contexts/telemetry/domain/report/record-reconciliation.js";
import type { TelemetrySinkRecord } from "../../../../../src/contexts/telemetry/domain/telemetry-sink-record.js";

const BASE: TelemetrySinkRecord = {
  sink_schema_version: 2,
  kind: "request",
  provenance: "local-read",
  tool: "claude",
  vendor_id: "s-1",
  vendor_field: "sessionId",
  step_attribution: "unattributed",
};

function record(overrides: Partial<TelemetrySinkRecord>): TelemetrySinkRecord {
  return { ...BASE, ...overrides };
}

describe("collapseSupersededTurns", () => {
  it("keeps the reading of a re-read turn that carries the largest counters", () => {
    const partial = record({ turn_id: "t-1", input_tokens: 10, output_tokens: 1 });
    const complete = record({ turn_id: "t-1", input_tokens: 10, output_tokens: 90 });

    expect(collapseSupersededTurns([partial, complete])).toStrictEqual([complete]);
  });

  it("leaves a record read once exactly as it arrived", () => {
    const only = record({ turn_id: "t-1", input_tokens: 10 });

    expect(collapseSupersededTurns([only])).toStrictEqual([only]);
  });

  it("never groups an export record on its turn id, which there names a prompt several calls share", () => {
    const first = record({ provenance: "export", turn_id: "p-1", output_tokens: 1 });
    const second = record({ provenance: "export", turn_id: "p-1", output_tokens: 2 });

    expect(collapseSupersededTurns([first, second])).toStrictEqual([first, second]);
  });
});

describe("collapseBilledRequests", () => {
  const BILLED = "req_1";

  it("keeps the record carrying the amount as the one a report sums", () => {
    const priced = record({ billed_request_id: BILLED, cost_usd: 0.5, output_tokens: 9 });
    const unpriced = record({ provenance: "export", billed_request_id: BILLED, output_tokens: 9 });

    expect(collapseBilledRequests([unpriced, priced])).toStrictEqual([priced]);
  });

  it("answers the same record whichever of two unpriced readings came first", () => {
    const local = record({ billed_request_id: BILLED, output_tokens: 9 });
    const exported = record({ provenance: "export", billed_request_id: BILLED, output_tokens: 9 });

    expect(collapseBilledRequests([local, exported])).toStrictEqual(
      collapseBilledRequests([exported, local])
    );
    expect(collapseBilledRequests([local, exported])).toHaveLength(1);
  });

  it("leaves a session record beside a request record sharing its billed id, never merged into it", () => {
    const request = record({ billed_request_id: BILLED, cost_usd: 0.5 });
    const session = record({ kind: "session", billed_request_id: BILLED, output_tokens: 9 });

    expect(collapseBilledRequests([request, session])).toStrictEqual([session, request]);
  });

  it("borrows the step a sibling resolved from a journal interval when the survivor states none", () => {
    const priced = record({ provenance: "export", billed_request_id: BILLED, cost_usd: 0.5 });
    const stepped = record({
      billed_request_id: BILLED,
      step_attribution: "journal-interval",
      step: "implement",
      step_plugin: "aidd-dev",
    });

    expect(collapseBilledRequests([priced, stepped])).toStrictEqual([
      {
        ...priced,
        step_attribution: "journal-interval",
        step: "implement",
        step_plugin: "aidd-dev",
      },
    ]);
  });

  it("prefers the tool-stated step over a journal-interval one when both siblings resolved one", () => {
    const priced = record({ provenance: "export", billed_request_id: BILLED, cost_usd: 0.5 });
    const fromJournal = record({
      billed_request_id: BILLED,
      step_attribution: "journal-interval",
      step: "plan",
    });
    const fromTool = record({
      billed_request_id: BILLED,
      step_attribution: "tool-stated",
      step: "implement",
    });

    expect(collapseBilledRequests([priced, fromJournal, fromTool])).toStrictEqual([
      { ...priced, step_attribution: "tool-stated", step: "implement", step_plugin: undefined },
    ]);
  });

  it("keeps the step the survivor stated itself rather than a sibling's", () => {
    const priced = record({
      provenance: "export",
      billed_request_id: BILLED,
      cost_usd: 0.5,
      step_attribution: "journal-interval",
      step: "plan",
    });
    const fromTool = record({
      billed_request_id: BILLED,
      step_attribution: "tool-stated",
      step: "implement",
    });

    expect(collapseBilledRequests([priced, fromTool])).toStrictEqual([priced]);
  });

  it("borrows the person, name included, from the sibling that carried one", () => {
    const priced = record({ provenance: "export", billed_request_id: BILLED, cost_usd: 0.5 });
    const known = record({
      billed_request_id: BILLED,
      person_id: "ada",
      person_display_name: "Ada L.",
    });

    expect(collapseBilledRequests([priced, known])).toStrictEqual([
      { ...priced, person_id: "ada", person_display_name: "Ada L." },
    ]);
  });

  it("borrows a person without inventing a display name the sibling never carried", () => {
    const priced = record({ provenance: "export", billed_request_id: BILLED, cost_usd: 0.5 });
    const known = record({ billed_request_id: BILLED, person_id: "ada" });

    expect(collapseBilledRequests([priced, known])).toStrictEqual([
      { ...priced, person_id: "ada" },
    ]);
  });

  it("keeps the person the survivor carried itself rather than a sibling's", () => {
    const priced = record({
      billed_request_id: BILLED,
      cost_usd: 0.5,
      person_id: "ada",
      person_display_name: "Ada L.",
    });
    const other = record({
      provenance: "export",
      billed_request_id: BILLED,
      person_id: "bob",
      person_display_name: "Bob",
    });

    expect(collapseBilledRequests([priced, other])).toStrictEqual([priced]);
  });
});
