import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../../../src/composition/installation.js";
import { RecordMachineClaims } from "../../../../../src/contexts/machine-claims/application/record/record-machine-claims.use-case.js";
import type { ClaimingMachineManifest } from "../../../../../src/contexts/machine-claims/ports/machine-manifest.js";
import { registeredCatalog } from "../../../../shared/testing/catalog-of.builder.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const { claude } = TOOL;
const REF = "aidd-telemetry@aidd-framework";

/** A machine record holding tools and their registrations, nothing else. */
class MachineRecord implements ClaimingMachineManifest {
  readonly tools = new Set<string>();
  readonly registrations = new Map<string, Readonly<Record<string, unknown>>>();
  hasTool(toolId: string): boolean {
    return this.tools.has(toolId);
  }
  addTool(toolId: string): void {
    this.tools.add(toolId);
  }
  getNativeRegistrations(toolId: string) {
    return this.registrations.get(toolId);
  }
  setNativeRegistrations(toolId: string, registrations: Readonly<Record<string, unknown>>): void {
    this.registrations.set(toolId, registrations);
  }
  getRecordedPlugins() {
    return [];
  }
  updatePlugin(): void {}
}

function recorderSaving(saved: ClaimingMachineManifest[], loaded: MachineRecord | null) {
  return new RecordMachineClaims(
    {
      fs: new InMemoryFileAdapter({}),
      userManifestRepo: {
        load: async () => loaded,
        save: async (machine) => {
          saved.push(machine);
        },
      },
      emptyManifest: () => new MachineRecord(),
      mergeClaims: registrationRecordRules.mergeCatalogueClaims,
    },
    registeredCatalog()
  );
}

const claimOf = (version: string | undefined) => ({
  project: { getToolVersion: () => version },
  outcomes: new Map([[claude, { catalogClaims: [], pluginRefs: [REF] }]]),
  marketplaces: [],
  scope: "user" as const,
});

describe("RecordMachineClaims", () => {
  it("changes nothing without a machine manifest to write to", async () => {
    const record = new RecordMachineClaims(
      {
        fs: new InMemoryFileAdapter({}),
        emptyManifest: () => new MachineRecord(),
        mergeClaims: registrationRecordRules.mergeCatalogueClaims,
      },
      registeredCatalog()
    );

    await expect(record.execute(claimOf("test"))).resolves.toBe(false);
  });

  it("starts an empty record for a machine that has none, tracking the project's tool", async () => {
    const saved: ClaimingMachineManifest[] = [];

    await expect(recorderSaving(saved, null).execute(claimOf("test"))).resolves.toBe(true);

    expect(saved).toHaveLength(1);
    expect(saved[0]?.hasTool(claude)).toBe(true);
    expect(saved[0]?.getNativeRegistrations(claude)?.pluginClaims).toEqual([
      { ref: REF, dependents: [] },
    ]);
  });

  it("claims nothing for a tool the project has no version of", async () => {
    const saved: ClaimingMachineManifest[] = [];

    await expect(recorderSaving(saved, null).execute(claimOf(undefined))).resolves.toBe(false);

    expect(saved).toEqual([]);
  });
});
