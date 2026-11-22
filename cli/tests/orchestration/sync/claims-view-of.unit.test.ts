import { describe, expect, it } from "vitest";
import type { NativeRegistrations } from "../../../src/contexts/installation/domain/manifest/native-registrations.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { claimsViewOf } from "../../../src/orchestration/sync/claims-view-of.js";
import { claimsRecorded } from "../../shared/testing/host-record-reading.builder.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";

const rules = {
  claimedRefs: (registrations: NativeRegistrations | undefined) =>
    claimsRecorded(registrations).map((claim) => claim.ref),
};
const tool = TOOL.copilot;
const other = TOOL.codex;

function manifestWith(pluginRefs: readonly string[]): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(tool, "test", []);
  manifest.setNativeRegistrations(tool, { binary: "copilot", pluginRefs });
  return manifest;
}

describe("the claims a host registration is checked against", () => {
  it("holds the run's own record for the tool, and none for a tool it never recorded", () => {
    const context = {
      manifest: manifestWith(["a@catalog"]),
      machineManifest: async () => undefined,
      machineKept: false,
      persistedProject: async () => undefined,
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
      manifest: manifestWith([]),
      machineManifest: async () => {
        reads += 1;
        return manifestWith(["machine@catalog"]);
      },
      machineKept: true,
      persistedProject: async () => undefined,
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
        manifest: manifestWith([]),
        machineManifest: async () => undefined,
        machineKept: false,
        persistedProject: async () => undefined,
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
        manifest: manifestWith(["new@catalog"]),
        machineManifest: async () => undefined,
        machineKept: false,
        persistedProject: async () => manifestWith(["saved@catalog"]),
      },
      tool,
      rules
    );

    expect((await view.persistedProject())?.pluginRefs).toEqual(["saved@catalog"]);
  });

  it("refuses a machine claim that keeps no dependents", async () => {
    const machine = Manifest.create();
    machine.addTool(tool, "test", []);
    machine.setNativeRegistrations(tool, {
      binary: "copilot",
      pluginClaims: [{ ref: "a@catalog" }],
    });
    const view = claimsViewOf(
      {
        manifest: manifestWith([]),
        machineManifest: async () => machine,
        machineKept: true,
        persistedProject: async () => undefined,
      },
      tool,
      rules
    );

    await expect(view.machine()).rejects.toThrow("expected a ref and its dependents");
  });
});
