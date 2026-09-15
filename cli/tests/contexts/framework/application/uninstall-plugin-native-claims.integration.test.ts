import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UninstallPluginUseCase } from "../../../../src/contexts/framework/application/uninstall/uninstall-plugin-use-case.js";
import { Manifest } from "../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../helpers/ports/in-memory-manifest-repository.js";

const REF = "sample-plugin@real-catalog";
const OTHER = "other-plugin@other-catalog";

function fixture(scope: "project" | "user" = "project") {
  const project = Manifest.create();
  project.addTool("codex", "1.0.0", []);
  project.addPlugin(
    "codex",
    InstalledPlugin.fromJSON({
      name: "sample-plugin",
      source: { kind: "local", path: "/fixture" },
      version: "1.0.0",
      strict: false,
      files: scope === "user" ? { "sample-plugin/skills/demo.md": "abc" } : {},
      scope,
      marketplace: "project-alias",
    })
  );
  project.setNativeRegistrations("codex", {
    binary: "codex",
    marketplaces: [
      { alias: "project-alias", hostName: "real-catalog" },
      { alias: "other-alias", hostName: "other-catalog" },
    ],
    pluginRefs: [REF, OTHER],
  });
  const machine = Manifest.create();
  machine.addTool("codex", "1.0.0", []);
  machine.setNativeRegistrations("codex", {
    binary: "codex",
    marketplaces: [{ alias: "project-alias", hostName: "real-catalog" }],
    pluginRefs: [REF],
    pluginClaims: [{ ref: REF, dependents: ["/A", "/B"] }],
  });
  return {
    projectRepo: new InMemoryManifestRepository(project),
    machineRepo: new InMemoryManifestRepository(machine),
    fs: new InMemoryFileAdapter(),
  };
}

describe("project plugin uninstall against shared native host ownership", () => {
  it("does not detach a same-name Cursor user claim for a project-scope plugin", async () => {
    const project = Manifest.create();
    project.addTool("cursor", "1.0.0", []);
    project.addPlugin(
      "cursor",
      InstalledPlugin.fromMetadata(
        "sample-plugin",
        "1.0.0",
        { kind: "local", path: "/fixture" },
        false,
        "project"
      )
    );
    project.addPlugin(
      "cursor",
      InstalledPlugin.fromMetadata(
        "other-plugin",
        "1.0.0",
        { kind: "local", path: "/fixture" },
        false,
        "user"
      )
    );
    const machine = Manifest.create();
    machine.addTool("cursor", "1.0.0", []);
    machine.addPlugin(
      "cursor",
      InstalledPlugin.fromMetadata(
        "sample-plugin",
        "1.0.0",
        { kind: "local", path: "/unrelated" },
        false,
        "user"
      ).withDependents(["/A", "/B"])
    );
    const machineRepo = new InMemoryManifestRepository(machine);
    const useCase = new UninstallPluginUseCase(
      new InMemoryFileAdapter(),
      new InMemoryManifestRepository(project),
      machineRepo
    );

    await useCase.execute({ pluginName: "sample-plugin", toolIds: ["cursor"], projectRoot: "/A" });
    expect(machineRepo.getCurrent()?.getPlugins("cursor")[0]?.dependents).toEqual(["/A", "/B"]);
    expect(machineRepo.saveCount).toBe(0);
  });

  it("drops A's exact projection and claim, leaving B and another catalogue intact", async () => {
    const f = fixture();
    const useCase = new UninstallPluginUseCase(f.fs, f.projectRepo, f.machineRepo);
    expect(
      await useCase.execute({ pluginName: "sample-plugin", toolIds: ["codex"], projectRoot: "/A" })
    ).toEqual([{ toolId: "codex", fileCount: 0, deletedFiles: [] }]);
    expect(f.projectRepo.getCurrent()?.getPlugins("codex")).toEqual([]);
    expect(f.projectRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginRefs).toEqual([
      OTHER,
    ]);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/B"] },
    ]);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginRefs).toEqual([REF]);
  });

  it("uninstalls a project projection but leaves machine-owned user plugin bytes for B", async () => {
    const f = fixture("user");
    const userPath = join("/user-home/.codex/plugins/sample-plugin/skills/demo.md");
    f.fs.setFile(userPath, "B's machine bytes");
    const useCase = new UninstallPluginUseCase(f.fs, f.projectRepo, f.machineRepo);
    expect(
      await useCase.execute({ pluginName: "sample-plugin", toolIds: [], projectRoot: "/A" })
    ).toEqual([{ toolId: "codex", fileCount: 0, deletedFiles: [] }]);
    expect(f.fs.getFile(userPath)).toBe("B's machine bytes");
    expect(
      f.machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims?.[0]?.dependents
    ).toEqual(["/B"]);
  });

  it("never detaches a shared claim when local file deletion fails", async () => {
    class RefusingFileAdapter extends InMemoryFileAdapter {
      override async deleteFile(): Promise<void> {
        throw new Error("local delete failed");
      }
    }
    const f = fixture();
    const plugin = f.projectRepo.getCurrent()?.getPlugins("codex")[0];
    const project = f.projectRepo.getCurrent();
    if (project === null || plugin === undefined) throw new Error("fixture missing plugin");
    project.updatePlugin("codex", plugin.withFiles(new Map([[".codex/skills/demo.md", "abc"]])));
    const useCase = new UninstallPluginUseCase(
      new RefusingFileAdapter(),
      f.projectRepo,
      f.machineRepo
    );
    await expect(
      useCase.execute({ pluginName: "sample-plugin", toolIds: ["codex"], projectRoot: "/A" })
    ).rejects.toThrow(/local delete failed/);
    expect(
      f.machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims?.[0]?.dependents
    ).toEqual(["/A", "/B"]);
    expect(f.machineRepo.saveCount).toBe(0);
  });

  it("does not detach any machine claim for a missing project plugin", async () => {
    const f = fixture();
    await expect(
      new UninstallPluginUseCase(f.fs, f.projectRepo, f.machineRepo).execute({
        pluginName: "foreign-plugin",
        toolIds: ["codex"],
        projectRoot: "/A",
      })
    ).rejects.toThrow(/not installed/i);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
    ]);
  });
});
