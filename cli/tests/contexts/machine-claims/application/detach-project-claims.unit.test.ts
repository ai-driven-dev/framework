import { describe, expect, it } from "vitest";
import { detachProjectClaims } from "../../../../src/contexts/machine-claims/application/detach-project-claims.js";
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
  for (const name of ["first", "second"]) {
    manifest.addPlugin(
      TOOL.cursor,
      new MachinePlugin({ name, scope: "user", dependents: ["/A", "/B"] })
    );
  }
  const repo = new InMemoryMachineManifestRepository(manifest, records);
  const fs = new InMemoryFileAdapter({}, ["/A", "/B"]);
  return { repo, detach: detachProjectClaims(repo, fs) };
}

describe("releasing a project's claims on the machine manifest", () => {
  it("releases its native refs and every user plugin it names, and no other project's", async () => {
    const f = fixture();

    await f.detach(
      "/A",
      [
        { toolId: TOOL.cursor, name: "first" },
        { toolId: TOOL.cursor, name: "second" },
      ],
      new Map([[TOOL.codex, [REF]]])
    );

    const current = f.repo.getCurrent();
    expect(f.repo.records.get(TOOL.codex)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/B"] },
    ]);
    expect(current?.getRecordedPlugins(TOOL.cursor).map((plugin) => plugin.machineClaim)).toEqual([
      ["/B"],
      ["/B"],
    ]);
  });

  it("leaves a user plugin it does not name", async () => {
    const f = fixture();

    await f.detach("/A", [{ toolId: TOOL.cursor, name: "first" }], new Map());

    expect(
      f.repo
        .getCurrent()
        ?.getRecordedPlugins(TOOL.cursor)
        .map((plugin) => plugin.machineClaim)
    ).toEqual([["/B"], ["/A", "/B"]]);
  });

  it("releases nothing when no machine manifest is bound", async () => {
    const detach = detachProjectClaims(undefined, new InMemoryFileAdapter());

    await detach("/A", [{ toolId: TOOL.cursor, name: "first" }], new Map([[TOOL.codex, [REF]]]));
  });
});
