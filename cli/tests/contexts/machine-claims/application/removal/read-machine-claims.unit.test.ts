import { describe, expect, it } from "vitest";
import { readMachineClaims } from "../../../../../src/contexts/machine-claims/application/removal/read-machine-claims.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import {
  InMemoryMachineManifest,
  InMemoryMachineManifestRepository,
} from "../../testing/in-memory-machine-manifest.fake.js";

describe("reading the machine-wide claims on a tool's refs", () => {
  const held = [
    { ref: "p@aidd", dependents: ["/a", "/b"] },
    { ref: "q@aidd", dependents: ["/b", "/c"] },
    { ref: "r@aidd", dependents: ["/d"] },
  ];
  const readerOf = (pluginClaims?: typeof held) => {
    const manifest = new InMemoryMachineManifest(TOOL.claude);
    const records = pluginClaims ? new Map([[TOOL.claude, { pluginClaims }]]) : undefined;
    return readMachineClaims(new InMemoryMachineManifestRepository(manifest, records));
  };

  it("names the refs the record claims for the tool", async () => {
    expect(await readerOf(held).claimedRefs(TOOL.claude)).toEqual(["p@aidd", "q@aidd", "r@aidd"]);
  });

  it("claims no ref for a tool the record keeps no registration of", async () => {
    expect(await readerOf().claimedRefs(TOOL.claude)).toEqual([]);
  });

  it("answers nothing when no machine record exists", async () => {
    const reader = readMachineClaims(new InMemoryMachineManifestRepository(null));
    expect(await reader.claimedRefs(TOOL.claude)).toBeUndefined();
  });

  it("names the other projects holding the refs, once each", async () => {
    const others = await readerOf(held).othersHolding(TOOL.claude, ["p@aidd", "q@aidd"], "/a");
    expect(others).toEqual(["/b", "/c"]);
  });

  it("names no project when none holds the refs", async () => {
    expect(await readerOf(held).othersHolding(TOOL.claude, ["x@aidd"], "/a")).toEqual([]);
  });
});
