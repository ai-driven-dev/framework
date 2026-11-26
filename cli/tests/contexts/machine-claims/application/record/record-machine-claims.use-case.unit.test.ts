import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../../../src/composition/contexts/installation.js";
import { RecordMachineClaims } from "../../../../../src/contexts/machine-claims/application/record/record-machine-claims.use-case.js";
import type {
  ClaimingMachineManifest,
  MachineRecords,
} from "../../../../../src/contexts/machine-claims/ports/machine-manifest.js";
import { registeredCatalog } from "../../../../shared/testing/catalog-of.builder.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const { claude } = TOOL;
const REF = "aidd-telemetry@aidd-framework";

/** A machine record holding tools, nothing else. */
class MachineRecord implements ClaimingMachineManifest {
  readonly tools = new Set<string>();
  hasTool(toolId: string): boolean {
    return this.tools.has(toolId);
  }
  addTool(toolId: string): void {
    this.tools.add(toolId);
  }
  getRecordedPlugins() {
    return [];
  }
  updatePlugin(): void {}
}

function recorderSaving(
  saved: ClaimingMachineManifest[],
  savedRecords: MachineRecords[],
  loaded: MachineRecord | null
) {
  return new RecordMachineClaims(
    {
      fs: new InMemoryFileAdapter({}),
      userManifestRepo: {
        load: async () => loaded,
        save: async (machine) => {
          saved.push(machine);
        },
        loadRecords: async () => new Map(),
        saveRecords: async (records) => {
          savedRecords.push(records);
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

describe("recording a project's machine claims", () => {
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
    const savedRecords: MachineRecords[] = [];

    await expect(recorderSaving(saved, savedRecords, null).execute(claimOf("test"))).resolves.toBe(
      true
    );

    expect(saved).toHaveLength(1);
    expect(saved[0]?.hasTool(claude)).toBe(true);
    expect(savedRecords).toHaveLength(1);
    expect(savedRecords[0]?.get(claude)?.pluginClaims).toEqual([{ ref: REF, dependents: [] }]);
  });

  it("claims nothing for a tool the project has no version of", async () => {
    const saved: ClaimingMachineManifest[] = [];
    const savedRecords: MachineRecords[] = [];

    await expect(
      recorderSaving(saved, savedRecords, null).execute(claimOf(undefined))
    ).resolves.toBe(false);

    expect(saved).toEqual([]);
    expect(savedRecords).toEqual([]);
  });
});
