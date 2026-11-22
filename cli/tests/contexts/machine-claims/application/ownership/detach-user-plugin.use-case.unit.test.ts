import { describe, expect, it } from "vitest";
import { DetachUserPlugin } from "../../../../../src/contexts/machine-claims/application/ownership/detach-user-plugin.use-case.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import {
  InMemoryMachineManifest,
  InMemoryMachineManifestRepository,
  loadingOnlyUnderLock,
} from "../../testing/in-memory-machine-manifest.fake.js";
import { MachinePlugin } from "../../testing/machine-plugin.fake.js";

function fixture(scope: Scope = "user", dependents: readonly string[] = ["/A", "/B"]) {
  const manifest = new InMemoryMachineManifest(TOOL.cursor);
  manifest.addPlugin(TOOL.cursor, new MachinePlugin({ name: "sample-plugin", scope, dependents }));
  return {
    repo: new InMemoryMachineManifestRepository(manifest),
    fs: new InMemoryFileAdapter({}, ["/A", "/B", "/C"]),
  };
}

describe("one project's canonical user plugin claim", () => {
  it("detaches only A's realpath, retaining B and the owned plugin bytes/record", async () => {
    const f = fixture();
    f.fs.setSymlink("/link-to-A", "/A");
    await new DetachUserPlugin(f.repo, f.fs).execute({
      toolId: TOOL.cursor,
      name: "sample-plugin",
      projectRoot: "/link-to-A",
    });
    expect(f.repo.getCurrent()?.getRecordedPlugins(TOOL.cursor)[0]?.machineClaim).toEqual(["/B"]);
    expect(f.repo.getCurrent()?.getRecordedPlugins(TOOL.cursor)).toHaveLength(1);
    expect(f.repo.saveCount).toBe(1);
  });

  it("does not drop B or save for an unrelated project", async () => {
    const f = fixture();
    await new DetachUserPlugin(f.repo, f.fs).execute({
      toolId: TOOL.cursor,
      name: "sample-plugin",
      projectRoot: "/C",
    });
    expect(f.repo.getCurrent()?.getRecordedPlugins(TOOL.cursor)[0]?.machineClaim).toEqual([
      "/A",
      "/B",
    ]);
    expect(f.repo.saveCount).toBe(0);
  });

  it("does not rewrite a machine record of another name or project scope", async () => {
    for (const [scope, name] of [
      ["user", "other-plugin"],
      ["project", "sample-plugin"],
    ] as const) {
      const f = fixture(scope);
      await new DetachUserPlugin(f.repo, f.fs).execute({
        toolId: TOOL.cursor,
        name: name,
        projectRoot: "/A",
      });
      expect(f.repo.getCurrent()?.getRecordedPlugins(TOOL.cursor)[0]?.machineClaim).toEqual([
        "/A",
        "/B",
      ]);
      expect(f.repo.saveCount).toBe(0);
    }
  });

  it("ignores a missing repo or manifest without inventing ownership", async () => {
    const fs = new InMemoryFileAdapter({}, ["/A", "/B", "/C"]);
    await new DetachUserPlugin(undefined, fs).execute({
      toolId: TOOL.cursor,
      name: "sample-plugin",
      projectRoot: "/A",
    });
    const repo = new InMemoryMachineManifestRepository();
    await new DetachUserPlugin(repo, fs).execute({
      toolId: TOOL.cursor,
      name: "sample-plugin",
      projectRoot: "/A",
    });
    expect(repo.getCurrent()).toBeNull();
    expect(repo.saveCount).toBe(0);
  });

  it("loads the latest machine record under exclusive access before detaching", async () => {
    const f = fixture();
    const locked = loadingOnlyUnderLock(f.repo);
    await new DetachUserPlugin(locked, f.fs).execute({
      toolId: TOOL.cursor,
      name: "sample-plugin",
      projectRoot: "/A",
    });
    expect(f.repo.getCurrent()?.getRecordedPlugins(TOOL.cursor)[0]?.machineClaim).toEqual(["/B"]);
  });
});
