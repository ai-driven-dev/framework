import { describe, expect, it } from "vitest";
import { DetachNativePluginRefs } from "../../../../../src/contexts/machine-claims/application/ownership/detach-native-plugin-refs.use-case.js";
import { readHeldClaims } from "../../../../../src/contexts/machine-claims/domain/plugin-claim.model.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import {
  InMemoryMachineManifest,
  InMemoryMachineManifestRepository,
  loadingOnlyUnderLock,
} from "../../testing/in-memory-machine-manifest.fake.js";

const { codex } = TOOL;

const TARGET = "sample-plugin@real-catalog";
const OTHER = "sample-plugin@other-catalog";

function fixture() {
  const machine = new InMemoryMachineManifest(codex);
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
  return {
    repo: new InMemoryMachineManifestRepository(machine, records),
    fs: new InMemoryFileAdapter({}, ["/A", "/B", "/C"]),
  };
}

describe("one project's exact native host ref claim", () => {
  it("detaches A's realpath only from the exact ref, preserving B and other catalogue claims", async () => {
    const f = fixture();
    f.fs.setSymlink("/link-to-A", "/A");
    await new DetachNativePluginRefs(f.repo, f.fs).execute({
      projectRoot: "/link-to-A",
      refsByTool: new Map([[codex, [TARGET]]]),
    });
    expect(f.repo.records.get(codex)?.pluginClaims).toEqual([
      { ref: TARGET, dependents: ["/B"] },
      { ref: OTHER, dependents: ["/A", "/C"] },
    ]);
    expect(f.repo.records.get(codex)?.pluginRefs).toEqual([TARGET, OTHER]);
    expect(f.repo.recordSaveCount).toBe(1);
  });

  it("does not invent a claim or save for an unrelated project or foreign ref", async () => {
    for (const [root, ref] of [
      ["/C", TARGET],
      ["/A", "foreign@real-catalog"],
    ] as const) {
      const f = fixture();
      await new DetachNativePluginRefs(f.repo, f.fs).execute({
        projectRoot: root,
        refsByTool: new Map([[codex, [ref]]]),
      });
      expect(f.repo.records.get(codex)?.pluginClaims).toEqual([
        { ref: TARGET, dependents: ["/A", "/B"] },
        { ref: OTHER, dependents: ["/A", "/C"] },
      ]);
      expect(f.repo.saveCount).toBe(0);
      expect(f.repo.recordSaveCount).toBe(0);
    }
  });

  it("does not act with no repo, no refs, no manifest, or no host claim record", async () => {
    const fs = new InMemoryFileAdapter({}, ["/A", "/B", "/C"]);
    await new DetachNativePluginRefs(undefined, fs).execute({
      projectRoot: "/A",
      refsByTool: new Map([[codex, [TARGET]]]),
    });
    const f = fixture();
    await new DetachNativePluginRefs(f.repo, fs).execute({
      projectRoot: "/A",
      refsByTool: new Map(),
    });
    await new DetachNativePluginRefs(new InMemoryMachineManifestRepository(), fs).execute({
      projectRoot: "/A",
      refsByTool: new Map([[codex, [TARGET]]]),
    });
    await new DetachNativePluginRefs(f.repo, fs).execute({
      projectRoot: "/A",
      refsByTool: new Map([[TOOL.copilot, [TARGET]]]),
    });
    expect(f.repo.saveCount).toBe(0);
    expect(f.repo.recordSaveCount).toBe(0);
  });

  it("holds exclusive access while loading the latest machine claims", async () => {
    const f = fixture();
    const repo = loadingOnlyUnderLock(f.repo);
    await new DetachNativePluginRefs(repo, f.fs).execute({
      projectRoot: "/A",
      refsByTool: new Map([[codex, [TARGET]]]),
    });
    expect(readHeldClaims(f.repo.records.get(codex)?.pluginClaims)[0]?.dependents).toEqual(["/B"]);
  });
});
