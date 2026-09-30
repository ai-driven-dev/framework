import { describe, expect, it } from "vitest";
import { TotalsAccumulator } from "../../../../../../src/contexts/telemetry/domain/cost-report.js";
import type { ResolvedPerson } from "../../../../../../src/contexts/telemetry/domain/person-resolution.js";
import {
  type PersonGroup,
  personGroupKey,
  personRawIdOf,
  personRows,
} from "../../../../../../src/contexts/telemetry/domain/report/axes/person-rows.js";
import {
  parseTelemetrySinkLine,
  type TelemetrySinkRecord,
} from "../../../../../../src/contexts/telemetry/domain/telemetry-sink-record.js";

const BASE: TelemetrySinkRecord = {
  sink_schema_version: 2,
  kind: "request",
  provenance: "local-read",
  tool: "claude",
  vendor_id: "s-1",
  vendor_field: "sessionId",
  step_attribution: "unattributed",
};

const NONE: ResolvedPerson = { resolution: "none", identities: [] };

function group(resolved: ResolvedPerson, costUsd: number): PersonGroup {
  const totals = new TotalsAccumulator();
  totals.add({ ...BASE, cost_usd: costUsd });
  return { resolved, totals };
}

function rowsOf(...groups: readonly PersonGroup[]) {
  return personRows(new Map(groups.map((entry, index) => [`k${index}`, entry])));
}

describe("personRawIdOf", () => {
  it("reads an empty person_id as no identifier", () => {
    expect(personRawIdOf({ ...BASE, person_id: "" })).toBeUndefined();
  });

  it("reads a person_id stored as a number as no identifier", () => {
    const stored = parseTelemetrySinkLine(JSON.stringify({ ...BASE, person_id: 42 }));

    expect(personRawIdOf(stored)).toBeUndefined();
  });

  it("reads a real identifier as itself", () => {
    expect(personRawIdOf({ ...BASE, person_id: "claude-machine-1" })).toBe("claude-machine-1");
  });
});

describe("personGroupKey", () => {
  it("keys an unresolved person on its raw identifier", () => {
    expect(personGroupKey({ resolution: "unresolved", identities: ["raw-1"] })).toBe("raw-1");
  });

  it("keys this machine's own person on the shared no-identifier key, never its personId", () => {
    const key = personGroupKey({ resolution: "this-machine", personId: "p", identities: ["p"] });

    expect(typeof key).toBe("symbol");
    expect(key).toBe(personGroupKey(NONE));
  });

  it("keys a mapped person carrying no personId on the shared no-identifier key", () => {
    const key = personGroupKey({ resolution: "mapped", identities: ["raw-1"] });

    expect(typeof key).toBe("symbol");
    expect(key).toBe(personGroupKey(NONE));
  });

  it("keys an unresolved person with no identifier on the shared no-identifier key", () => {
    const key = personGroupKey({ resolution: "unresolved", identities: [] });

    expect(typeof key).toBe("symbol");
    expect(key).toBe(personGroupKey(NONE));
  });
});

describe("personRows", () => {
  it("carries neither person nor displayName on a row that resolved to nobody", () => {
    expect(rowsOf(group(NONE, 1))).toStrictEqual([
      { resolution: "none", identities: [], totals: { requests: 1, costMicroUsd: 1_000_000 } },
    ]);
  });

  it("reads mapped, this-machine, unresolved, none, whatever their sizes", () => {
    const rows = rowsOf(
      group(NONE, 4),
      group({ resolution: "unresolved", identities: ["raw"] }, 3),
      group({ resolution: "this-machine", personId: "me", identities: ["me"] }, 2),
      group({ resolution: "mapped", personId: "her", identities: ["her"] }, 1)
    );

    expect(rows.map((row) => row.resolution)).toStrictEqual([
      "mapped",
      "this-machine",
      "unresolved",
      "none",
    ]);
  });

  it("breaks a tie between two mapped people on the person, not the evidence", () => {
    const rows = rowsOf(
      group({ resolution: "mapped", personId: "b", identities: ["aaa"] }, 1),
      group({ resolution: "mapped", personId: "a", identities: ["zzz"] }, 1)
    );

    expect(rows.map((row) => row.person)).toStrictEqual(["a", "b"]);
  });

  it("breaks a tie between two unresolved identifiers on the identifier", () => {
    const rows = rowsOf(
      group({ resolution: "unresolved", identities: ["raw-b"] }, 1),
      group({ resolution: "unresolved", identities: ["raw-a"] }, 1)
    );

    expect(rows.map((row) => row.identities)).toStrictEqual([["raw-a"], ["raw-b"]]);
  });
});
