import { describe, expect, it } from "vitest";
import { removalClaims } from "../../../../src/contexts/machine-claims/application/removal-claims.js";
import type { MachineRecords } from "../../../../src/contexts/machine-claims/ports/machine-manifest.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import {
  InMemoryMachineManifest,
  InMemoryMachineManifestRepository,
} from "../testing/in-memory-machine-manifest.fake.js";
import { MachinePlugin } from "../testing/machine-plugin.fake.js";

const REF = "sample-plugin@real-catalog";

function fixture() {
  const manifest = new InMemoryMachineManifest(TOOL.codex, TOOL.cursor);
  const records: MachineRecords = new Map([
    [
      TOOL.codex,
      {
        binary: "codex",
        marketplaces: [{ alias: "real-catalog", hostName: "real-catalog" }],
        pluginRefs: [REF],
        pluginClaims: [{ ref: REF, dependents: ["/A", "/B"] }],
      },
    ],
  ]);
  manifest.addPlugin(
    TOOL.cursor,
    new MachinePlugin({ name: "sample-plugin", scope: "user", dependents: ["/A", "/B"] })
  );
  const repo = new InMemoryMachineManifestRepository(manifest, records);
  const fs = new InMemoryFileAdapter({}, ["/A", "/B"]);
  return { repo, claims: removalClaims(repo, fs) };
}

describe("the claims a plugin removal releases", () => {
  it("releases the project's native refs from the machine manifest it was bound to", async () => {
    const f = fixture();

    await f.claims.detachNativeRefs("/A", new Map([[TOOL.codex, [REF]]]));

    expect(f.repo.records.get(TOOL.codex)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/B"] },
    ]);
  });

  it("releases the project's claim on a user plugin from the machine manifest it was bound to", async () => {
    const f = fixture();

    await f.claims.detachUserPlugin(TOOL.cursor, "sample-plugin", "/A");

    expect(f.repo.getCurrent()?.getRecordedPlugins(TOOL.cursor)[0]?.machineClaim).toEqual(["/B"]);
  });

  it("releases nothing when no machine manifest is bound", async () => {
    const claims = removalClaims(undefined, new InMemoryFileAdapter());

    await claims.detachNativeRefs("/A", new Map([[TOOL.codex, [REF]]]));
    await claims.detachUserPlugin(TOOL.cursor, "sample-plugin", "/A");
  });
});
