import { describe, expect, it } from "vitest";
import { IsMachineOwnedNativeRef } from "../../../../../src/contexts/machine-claims/application/ownership/is-machine-owned-native-ref.use-case.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import {
  InMemoryMachineManifest,
  InMemoryMachineManifestRepository,
} from "../../testing/in-memory-machine-manifest.fake.js";

const { codex } = TOOL;

const TARGET = "sample-plugin@real-catalog";
const OTHER = "sample-plugin@other-catalog";

function repoClaiming() {
  const records = new Map([
    [
      codex,
      {
        binary: "codex",
        marketplaces: [
          { alias: "real-catalog", hostName: "real-catalog" },
          { alias: "other-catalog", hostName: "other-catalog" },
        ],
        pluginRefs: [TARGET, OTHER],
        pluginClaims: [
          { ref: TARGET, dependents: ["/A", "/B"] },
          { ref: OTHER, dependents: ["/A", "/C"] },
        ],
      },
    ],
  ]);
  return new InMemoryMachineManifestRepository(new InMemoryMachineManifest(codex), records);
}

describe("one project's exact native host ref claim", () => {
  it("recognizes only canonical machine claims, not another catalogue or missing manifests", async () => {
    expect(await new IsMachineOwnedNativeRef(repoClaiming()).execute(codex, TARGET)).toBe(true);
    expect(
      await new IsMachineOwnedNativeRef(repoClaiming()).execute(codex, "foreign@real-catalog")
    ).toBe(false);
    expect(await new IsMachineOwnedNativeRef(repoClaiming()).execute(TOOL.copilot, TARGET)).toBe(
      false
    );
    expect(
      await new IsMachineOwnedNativeRef(new InMemoryMachineManifestRepository()).execute(
        codex,
        TARGET
      )
    ).toBe(false);
    expect(await new IsMachineOwnedNativeRef(undefined).execute(codex, TARGET)).toBe(false);
  });

  it("recognizes no claim on a registration that records none", async () => {
    const machine = new InMemoryMachineManifest(codex);
    const records = new Map([[codex, { binary: "codex", marketplaces: [], pluginRefs: [TARGET] }]]);

    expect(
      await new IsMachineOwnedNativeRef(
        new InMemoryMachineManifestRepository(machine, records)
      ).execute(codex, TARGET)
    ).toBe(false);
  });
});
