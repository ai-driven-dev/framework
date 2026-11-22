import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../src/composition/installation.js";
import { RecordActivation } from "../../../src/contexts/installation/application/sync/record-activation.use-case.js";
import { RecordMachineClaims } from "../../../src/contexts/installation/application/sync/record-machine-claims.use-case.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import { registeredCatalog } from "../../shared/testing/catalog-of.builder.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";

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
    const project = aManifest()
      .withTool(claude, [], { version: "test" })
      .withTool(codex, [], { version: "test" })
      .build();
    const machine = aManifest()
      .withTool(claude, [], { version: "test" })
      .withTool(codex, [], { version: "test" })
      .build();
    machine.setNativeRegistrations(codex, {
      binary: "codex",
      marketplaces: [],
      pluginRefs: [],
      pluginClaims: [{ ref: HELD_REF, dependents: [] }],
    });
    const repo = new InMemoryManifestRepository(machine);
    const deps = {
      fs: new InMemoryFileAdapter(),
      records: registrationRecordRules,
      userManifestRepo: repo,
    };
    const record = new RecordActivation(
      { ...deps, machineClaims: new RecordMachineClaims(deps, registeredCatalog()) },
      registeredCatalog()
    );

    await record.execute({
      kind: "machine-claims",
      project,
      outcomes: new Map([
        [claude, outcomeOf(CLAIMED_REF)],
        [codex, outcomeOf(HELD_REF)],
      ]),
      marketplaces: [],
      scope: "user",
    });

    expect(repo.saveCount).toBe(1);
    expect(repo.getCurrent()?.getNativeRegistrations(claude)?.pluginClaims).toEqual([
      { ref: CLAIMED_REF, dependents: [] },
    ]);
  });
});
