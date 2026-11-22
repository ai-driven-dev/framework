import { describe, expect, it } from "vitest";
import type {
  RegistrationRecordData,
  RegistrationRecords,
} from "../../../../src/contexts/installation/ports/record/registration-records.js";
import { claimsViewOf } from "../../../../src/orchestration/sync/settings/claims-view-of.js";
import { claimsRecorded } from "../../../shared/testing/host-record-reading.builder.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_TOOL,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

const rules = {
  claimedRefs: (registrations: RegistrationRecordData | undefined) =>
    claimsRecorded(registrations).map((claim) => claim.ref),
};
const tool = SYNTHETIC_TOOL;
const other = SECOND_SYNTHETIC_TOOL;

function recordsWith(pluginRefs: readonly string[]): RegistrationRecords {
  return new Map([[tool, { binary: "copilot", pluginRefs }]]);
}

describe("the claims a host registration is checked against", () => {
  it("holds the run's own record for the tool, and none for a tool it never recorded", () => {
    const context = {
      records: recordsWith(["a@catalog"]),
      machineRecords: async () => new Map(),
      machineKept: false,
      persistedProject: async () => new Map(),
    };

    expect(claimsViewOf(context, tool, rules).recorded).toEqual({
      binary: "copilot",
      pluginRefs: ["a@catalog"],
    });
    expect(claimsViewOf(context, other, rules).recorded).toBeUndefined();
  });

  it("reads the machine record only when asked, and says whether one is kept", async () => {
    let reads = 0;
    const context = {
      records: recordsWith([]),
      machineRecords: async () => {
        reads += 1;
        return recordsWith(["machine@catalog"]);
      },
      machineKept: true,
      persistedProject: async () => new Map(),
    };

    const view = claimsViewOf(context, tool, rules);

    expect(reads).toBe(0);
    expect(view.machineKept).toBe(true);
    const machine = await view.machine();
    expect(machine?.pluginRefs).toEqual(["machine@catalog"]);
    expect(machine?.claimedRefs).toEqual([]);
    expect(reads).toBe(1);
  });

  it("has no machine record when none is kept", async () => {
    const view = claimsViewOf(
      {
        records: recordsWith([]),
        machineRecords: async () => new Map(),
        machineKept: false,
        persistedProject: async () => new Map(),
      },
      tool,
      rules
    );

    expect(view.machineKept).toBe(false);
    expect(await view.machine()).toBeUndefined();
  });

  it("reads the project record as last saved, not the one this run is changing", async () => {
    const view = claimsViewOf(
      {
        records: recordsWith(["new@catalog"]),
        machineRecords: async () => new Map(),
        machineKept: false,
        persistedProject: async () => recordsWith(["saved@catalog"]),
      },
      tool,
      rules
    );

    expect((await view.persistedProject())?.pluginRefs).toEqual(["saved@catalog"]);
  });

  it("refuses a machine claim that keeps no dependents", async () => {
    const machine = new Map([[tool, { binary: "copilot", pluginClaims: [{ ref: "a@catalog" }] }]]);
    const view = claimsViewOf(
      {
        records: recordsWith([]),
        machineRecords: async () => machine,
        machineKept: true,
        persistedProject: async () => new Map(),
      },
      tool,
      rules
    );

    await expect(view.machine()).rejects.toThrow("expected a ref and its dependents");
  });
});
