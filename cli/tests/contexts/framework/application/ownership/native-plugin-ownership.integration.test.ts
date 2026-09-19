import { describe, expect, it } from "vitest";
import {
  detachNativePluginRefs,
  isMachineOwnedNativeRef,
} from "../../../../../src/contexts/framework/application/ownership/native-plugin-ownership.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";

const TARGET = "sample-plugin@real-catalog";
const OTHER = "sample-plugin@other-catalog";

function fixture() {
  const machine = Manifest.create();
  machine.addTool("codex", "1.0.0", []);
  machine.setNativeRegistrations("codex", {
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
  return { repo: new InMemoryManifestRepository(machine), fs: new InMemoryFileAdapter() };
}

describe("one project's exact native host ref claim", () => {
  it("recognizes only canonical machine claims, not another catalogue or missing manifests", async () => {
    const f = fixture();
    expect(await isMachineOwnedNativeRef(f.repo, "codex", TARGET)).toBe(true);
    expect(await isMachineOwnedNativeRef(f.repo, "codex", "foreign@real-catalog")).toBe(false);
    expect(await isMachineOwnedNativeRef(f.repo, "copilot", TARGET)).toBe(false);
    expect(await isMachineOwnedNativeRef(new InMemoryManifestRepository(), "codex", TARGET)).toBe(
      false
    );
    expect(await isMachineOwnedNativeRef(undefined, "codex", TARGET)).toBe(false);
  });

  it("detaches A's realpath only from the exact ref, preserving B and other catalogue claims", async () => {
    const f = fixture();
    f.fs.setSymlink("/link-to-A", "/A");
    await detachNativePluginRefs(f.repo, f.fs, "/link-to-A", new Map([["codex", [TARGET]]]));
    expect(f.repo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: TARGET, dependents: ["/B"] },
      { ref: OTHER, dependents: ["/A", "/C"] },
    ]);
    expect(f.repo.getCurrent()?.getNativeRegistrations("codex")?.pluginRefs).toEqual([
      TARGET,
      OTHER,
    ]);
    expect(f.repo.saveCount).toBe(1);
  });

  it("does not invent a claim or save for an unrelated project or foreign ref", async () => {
    for (const [root, ref] of [
      ["/C", TARGET],
      ["/A", "foreign@real-catalog"],
    ] as const) {
      const f = fixture();
      await detachNativePluginRefs(f.repo, f.fs, root, new Map([["codex", [ref]]]));
      expect(f.repo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
        { ref: TARGET, dependents: ["/A", "/B"] },
        { ref: OTHER, dependents: ["/A", "/C"] },
      ]);
      expect(f.repo.saveCount).toBe(0);
    }
  });

  it("does not act with no repo, no refs, no manifest, or no host claim record", async () => {
    const fs = new InMemoryFileAdapter();
    await detachNativePluginRefs(undefined, fs, "/A", new Map([["codex", [TARGET]]]));
    const f = fixture();
    await detachNativePluginRefs(f.repo, fs, "/A", new Map());
    await detachNativePluginRefs(
      new InMemoryManifestRepository(),
      fs,
      "/A",
      new Map([["codex", [TARGET]]])
    );
    await detachNativePluginRefs(f.repo, fs, "/A", new Map([["copilot", [TARGET]]]));
    expect(f.repo.saveCount).toBe(0);
  });

  it("holds exclusive access while loading the latest machine claims", async () => {
    const f = fixture();
    let entered = false;
    const repo = {
      path: f.repo.path,
      load: () => {
        expect(entered).toBe(true);
        return f.repo.load();
      },
      save: (manifest: Manifest) => f.repo.save(manifest),
      delete: () => f.repo.delete(),
      withExclusiveAccess: async <T>(action: () => Promise<T>): Promise<T> => {
        entered = true;
        try {
          return await action();
        } finally {
          entered = false;
        }
      },
    };
    await detachNativePluginRefs(repo, f.fs, "/A", new Map([["codex", [TARGET]]]));
    expect(
      f.repo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims?.[0]?.dependents
    ).toEqual(["/B"]);
  });
});
