import { describe, expect, it } from "vitest";
import { detachUserPlugin } from "../../../../../src/contexts/framework/application/ownership/user-plugin-ownership.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";

function fixture(scope: "project" | "user" = "user", dependents: readonly string[] = ["/A", "/B"]) {
  const manifest = Manifest.create();
  manifest.addTool("cursor", "1.0.0", []);
  manifest.addPlugin(
    "cursor",
    InstalledPlugin.fromJSON({
      name: "sample-plugin",
      source: { kind: "local", path: "/fixture" },
      version: "1.0.0",
      strict: false,
      files: {},
      scope,
      dependents: [...dependents],
    })
  );
  return { repo: new InMemoryManifestRepository(manifest), fs: new InMemoryFileAdapter() };
}

describe("one project's canonical user plugin claim", () => {
  it("detaches only A's realpath, retaining B and the owned plugin bytes/record", async () => {
    const f = fixture();
    f.fs.setSymlink("/link-to-A", "/A");
    await detachUserPlugin(f.repo, f.fs, "cursor", "sample-plugin", "/link-to-A");
    expect(f.repo.getCurrent()?.getPlugins("cursor")[0]?.dependents).toEqual(["/B"]);
    expect(f.repo.getCurrent()?.getPlugins("cursor")).toHaveLength(1);
    expect(f.repo.saveCount).toBe(1);
  });

  it("does not drop B or save for an unrelated project", async () => {
    const f = fixture();
    await detachUserPlugin(f.repo, f.fs, "cursor", "sample-plugin", "/C");
    expect(f.repo.getCurrent()?.getPlugins("cursor")[0]?.dependents).toEqual(["/A", "/B"]);
    expect(f.repo.saveCount).toBe(0);
  });

  it("does not rewrite a machine record of another name or project scope", async () => {
    for (const [scope, name] of [
      ["user", "other-plugin"],
      ["project", "sample-plugin"],
    ] as const) {
      const f = fixture(scope);
      await detachUserPlugin(f.repo, f.fs, "cursor", name, "/A");
      expect(f.repo.getCurrent()?.getPlugins("cursor")[0]?.dependents).toEqual(["/A", "/B"]);
      expect(f.repo.saveCount).toBe(0);
    }
  });

  it("ignores a missing repo or manifest without inventing ownership", async () => {
    const fs = new InMemoryFileAdapter();
    await detachUserPlugin(undefined, fs, "cursor", "sample-plugin", "/A");
    const repo = new InMemoryManifestRepository();
    await detachUserPlugin(repo, fs, "cursor", "sample-plugin", "/A");
    expect(repo.getCurrent()).toBeNull();
    expect(repo.saveCount).toBe(0);
  });

  it("loads the latest machine record under exclusive access before detaching", async () => {
    const f = fixture();
    let entered = false;
    const locked = {
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
    await detachUserPlugin(locked, f.fs, "cursor", "sample-plugin", "/A");
    expect(f.repo.getCurrent()?.getPlugins("cursor")[0]?.dependents).toEqual(["/B"]);
  });
});
