import { describe, expect, it } from "vitest";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { claimsViewOf } from "../../../src/orchestration/sync/claims-view-of.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";

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

    expect(claimsViewOf(context, tool).recorded).toEqual({
      binary: "copilot",
      pluginRefs: ["a@catalog"],
    });
    expect(claimsViewOf(context, other).recorded).toBeUndefined();
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

    const view = claimsViewOf(context, tool);

    expect(reads).toBe(0);
    expect(view.machineKept).toBe(true);
    expect((await view.machine())?.pluginRefs).toEqual(["machine@catalog"]);
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
      tool
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
      tool
    );

    expect((await view.persistedProject())?.pluginRefs).toEqual(["saved@catalog"]);
  });
});
