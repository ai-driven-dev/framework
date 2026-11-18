import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../src/composition/installation.js";
import { RecordActivation } from "../../../src/contexts/installation/application/sync/record-activation.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { registeredCatalog } from "../../contexts/tools/testing/catalog-of.js";
import { DeterministicHasher } from "../../helpers/ports/deterministic-hasher.js";
import { InMemoryFileAdapter } from "../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../helpers/ports/in-memory-manifest-repository.js";
import { TOOL } from "../../shared/testing/registered-tools.js";

const { claude, codex } = TOOL;

const CLAIMED_REF = "aidd-telemetry@aidd-framework";
const HELD_REF = "held@market";

function outcomeOf(ref: string) {
  return {
    marketplaces: [],
    preservedMarketplaces: [],
    catalogClaims: [],
    pluginRefs: [ref],
    buildFailed: false,
  };
}

describe("the machine record is saved once any tool of the run changed it", () => {
  it("keeps the first tool's claim when a later tool's record is already current", async () => {
    const project = Manifest.create();
    project.addTool(claude, "test", []);
    project.addTool(codex, "test", []);
    const machine = Manifest.create();
    machine.addTool(claude, "test", []);
    machine.addTool(codex, "test", []);
    machine.setNativeRegistrations(codex, {
      binary: "codex",
      marketplaces: [],
      pluginRefs: [],
      pluginClaims: [{ ref: HELD_REF, dependents: [] }],
    });
    const repo = new InMemoryManifestRepository(machine);
    const record = new RecordActivation(
      new InMemoryFileAdapter(),
      new DeterministicHasher(),
      registrationRecordRules,
      registeredCatalog(),
      repo
    );

    await record.recordMachinePluginClaims(
      project,
      new Map([
        [claude, outcomeOf(CLAIMED_REF)],
        [codex, outcomeOf(HELD_REF)],
      ]),
      [],
      "user"
    );

    expect(repo.saveCount).toBe(1);
    expect(repo.getCurrent()?.getNativeRegistrations(claude)?.pluginClaims).toEqual([
      { ref: CLAIMED_REF, dependents: [] },
    ]);
  });
});
