import { describe, expect, it } from "vitest";
import type {
  ToolRecord,
  ToolRecords,
} from "../../../../src/contexts/installation/contract/records/scope-records.js";
import { claimsViewOf } from "../../../../src/orchestration/sync/settings/claims-view-of.js";
import { claimsRecorded } from "../../../shared/testing/host-record-reading.builder.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_TOOL,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

const claimedRefs = (registrations: ToolRecord | undefined) =>
  claimsRecorded(registrations).map((claim) => claim.ref);
const none = async () => new Map();
const tool = SYNTHETIC_TOOL;
const other = SECOND_SYNTHETIC_TOOL;

function recordsWith(pluginRefs: readonly string[]): ToolRecords {
  return new Map([[tool, { binary: "copilot", pluginRefs }]]);
}

describe("the claims a host registration is checked against", () => {
  it("holds the run's own record for the tool, and none for a tool it never recorded", () => {
    const source = { claimedRefs, machine: undefined, persistedProject: none };
    const recorded = recordsWith(["a@catalog"]);

    expect(claimsViewOf(recorded, tool, source).recorded).toEqual({
      binary: "copilot",
      pluginRefs: ["a@catalog"],
    });
    expect(claimsViewOf(recorded, other, source).recorded).toBeUndefined();
  });

  it("reads the machine record only when asked, and says one is kept", async () => {
    let reads = 0;
    const source = {
      claimedRefs,
      machine: async () => {
        reads += 1;
        return recordsWith(["machine@catalog"]);
      },
      persistedProject: none,
    };

    const view = claimsViewOf(recordsWith([]), tool, source);

    expect(reads).toBe(0);
    expect(view.machineKept).toBe(true);
    const machine = await view.machine();
    expect(machine?.pluginRefs).toEqual(["machine@catalog"]);
    expect(machine?.claimedRefs).toEqual([]);
    expect(reads).toBe(1);
  });

  it("has no machine record when none is kept", async () => {
    const view = claimsViewOf(recordsWith([]), tool, {
      claimedRefs,
      machine: undefined,
      persistedProject: none,
    });

    expect(view.machineKept).toBe(false);
    expect(await view.machine()).toBeUndefined();
  });

  it("reads the project record as last saved, not the one this run is changing", async () => {
    const view = claimsViewOf(recordsWith(["new@catalog"]), tool, {
      claimedRefs,
      machine: undefined,
      persistedProject: async () => recordsWith(["saved@catalog"]),
    });

    expect((await view.persistedProject())?.pluginRefs).toEqual(["saved@catalog"]);
  });

  it("refuses a machine claim that keeps no dependents", async () => {
    const machine = new Map([[tool, { binary: "copilot", pluginClaims: [{ ref: "a@catalog" }] }]]);
    const view = claimsViewOf(recordsWith([]), tool, {
      claimedRefs,
      machine: async () => machine,
      persistedProject: none,
    });

    await expect(view.machine()).rejects.toThrow("expected a ref and its dependents");
  });
});
