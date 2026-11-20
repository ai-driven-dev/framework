import { describe, expect, it } from "vitest";
import {
  detachNativePluginRefs,
  isMachineOwnedNativeRef,
} from "../../../../src/contexts/machine-claims/application/native-plugin-ownership.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.js";
import { TOOL } from "../../../shared/testing/registered-tools.js";
import {
  InMemoryMachineManifest,
  InMemoryMachineManifestRepository,
  loadingOnlyUnderLock,
} from "../testing/in-memory-machine-manifest.fake.js";

const { codex } = TOOL;

const TARGET = "sample-plugin@real-catalog";
const OTHER = "sample-plugin@other-catalog";

function fixture() {
  const machine = new InMemoryMachineManifest(codex);
  machine.setNativeRegistrations(codex, {
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
  });
  return {
    repo: new InMemoryMachineManifestRepository(machine),
    fs: new InMemoryFileAdapter({}, ["/A", "/B", "/C"]),
  };
}

describe("one project's exact native host ref claim", () => {
  it("recognizes only canonical machine claims, not another catalogue or missing manifests", async () => {
    const f = fixture();
    expect(await isMachineOwnedNativeRef(f.repo, codex, TARGET)).toBe(true);
    expect(await isMachineOwnedNativeRef(f.repo, codex, "foreign@real-catalog")).toBe(false);
    expect(await isMachineOwnedNativeRef(f.repo, TOOL.copilot, TARGET)).toBe(false);
    expect(
      await isMachineOwnedNativeRef(new InMemoryMachineManifestRepository(), codex, TARGET)
    ).toBe(false);
    expect(await isMachineOwnedNativeRef(undefined, codex, TARGET)).toBe(false);
  });

  it("recognizes no claim on a registration that records none", async () => {
    const machine = new InMemoryMachineManifest(codex);
    machine.setNativeRegistrations(codex, {
      binary: "codex",
      marketplaces: [],
      pluginRefs: [TARGET],
    });

    expect(
      await isMachineOwnedNativeRef(new InMemoryMachineManifestRepository(machine), codex, TARGET)
    ).toBe(false);
  });

  it("detaches A's realpath only from the exact ref, preserving B and other catalogue claims", async () => {
    const f = fixture();
    f.fs.setSymlink("/link-to-A", "/A");
    await detachNativePluginRefs(f.repo, f.fs, "/link-to-A", new Map([[codex, [TARGET]]]));
    expect(f.repo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
      { ref: TARGET, dependents: ["/B"] },
      { ref: OTHER, dependents: ["/A", "/C"] },
    ]);
    expect(f.repo.getCurrent()?.getNativeRegistrations(codex)?.pluginRefs).toEqual([TARGET, OTHER]);
    expect(f.repo.saveCount).toBe(1);
  });

  it("does not invent a claim or save for an unrelated project or foreign ref", async () => {
    for (const [root, ref] of [
      ["/C", TARGET],
      ["/A", "foreign@real-catalog"],
    ] as const) {
      const f = fixture();
      await detachNativePluginRefs(f.repo, f.fs, root, new Map([[codex, [ref]]]));
      expect(f.repo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
        { ref: TARGET, dependents: ["/A", "/B"] },
        { ref: OTHER, dependents: ["/A", "/C"] },
      ]);
      expect(f.repo.saveCount).toBe(0);
    }
  });

  it("does not act with no repo, no refs, no manifest, or no host claim record", async () => {
    const fs = new InMemoryFileAdapter({}, ["/A", "/B", "/C"]);
    await detachNativePluginRefs(undefined, fs, "/A", new Map([[codex, [TARGET]]]));
    const f = fixture();
    await detachNativePluginRefs(f.repo, fs, "/A", new Map());
    await detachNativePluginRefs(
      new InMemoryMachineManifestRepository(),
      fs,
      "/A",
      new Map([[codex, [TARGET]]])
    );
    await detachNativePluginRefs(f.repo, fs, "/A", new Map([[TOOL.copilot, [TARGET]]]));
    expect(f.repo.saveCount).toBe(0);
  });

  it("holds exclusive access while loading the latest machine claims", async () => {
    const f = fixture();
    const repo = loadingOnlyUnderLock(f.repo);
    await detachNativePluginRefs(repo, f.fs, "/A", new Map([[codex, [TARGET]]]));
    expect(
      f.repo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims?.[0]?.dependents
    ).toEqual(["/B"]);
  });
});
