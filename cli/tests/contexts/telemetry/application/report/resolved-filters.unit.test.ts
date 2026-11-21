import { describe, expect, it } from "vitest";
import { resolvedFilters } from "../../../../../src/contexts/telemetry/application/report/resolved-filters.js";
import { NO_FILTERS } from "../../../../../src/contexts/telemetry/contract/report-filter.js";
import { aUsageRecord } from "../../testing/usage-record.builder.js";

const records = [
  aUsageRecord().with({ session_id: "a1b2-first", repository_id: "r-one" }).build(),
  aUsageRecord().with({ session_id: "a1b2-second", repository_id: "r-two" }).build(),
];

describe("resolvedFilters", () => {
  it("keeps the filters as asked when no session or repository is typed", () => {
    expect(resolvedFilters(records, NO_FILTERS, undefined)).toEqual(NO_FILTERS);
  });

  it("completes the start of an id that one call of the period has", () => {
    const asked = { ...NO_FILTERS, session: "a1b2-f", repository: "r-t" };
    expect(resolvedFilters(records, asked, undefined)).toEqual({
      ...NO_FILTERS,
      session: "a1b2-first",
      repository: "r-two",
    });
  });

  it("names every id a start shares, sorted, and keeps the flag", () => {
    const asked = { ...NO_FILTERS, session: "a1b2" };
    expect(resolvedFilters(records, asked, undefined)).toEqual({
      status: "ambiguous",
      flag: "session",
      typed: "a1b2",
      ids: ["a1b2-first", "a1b2-second"],
    });
  });

  it("keeps a start no call has as typed", () => {
    const asked = { ...NO_FILTERS, session: "zzz" };
    expect(resolvedFilters(records, asked, undefined)).toMatchObject({ session: "zzz" });
  });

  it("takes the located repository in full, never as the start of another", () => {
    expect(resolvedFilters(records, NO_FILTERS, "r")).toMatchObject({ repository: "r" });
  });
});
