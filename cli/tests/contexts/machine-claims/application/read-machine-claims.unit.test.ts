import { describe, expect, it } from "vitest";
import { readMachineClaims } from "../../../../src/contexts/machine-claims/application/read-machine-claims.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import {
  InMemoryMachineManifest,
  InMemoryMachineManifestRepository,
} from "../testing/in-memory-machine-manifest.fake.js";

describe("reading the machine-wide claims on a tool's refs", () => {
  it("names the claims the record holds for the tool", async () => {
    const manifest = new InMemoryMachineManifest(TOOL.claude);
    const pluginClaims = [{ ref: "p@aidd", dependents: ["/project"] }];
    manifest.setNativeRegistrations(TOOL.claude, { pluginClaims });

    const claims = await readMachineClaims(new InMemoryMachineManifestRepository(manifest))(
      TOOL.claude
    );

    expect(claims).toEqual(pluginClaims);
  });

  it("holds no claim for a tool the record keeps no registration of", async () => {
    const repo = new InMemoryMachineManifestRepository(new InMemoryMachineManifest(TOOL.claude));

    expect(await readMachineClaims(repo)(TOOL.claude)).toEqual([]);
  });

  it("answers nothing when no machine record exists", async () => {
    const repo = new InMemoryMachineManifestRepository(null);

    expect(await readMachineClaims(repo)(TOOL.claude)).toBeUndefined();
  });
});
