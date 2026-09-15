import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { MarketplaceRemoveUseCase } from "../../../../../src/contexts/framework/application/flows/marketplace-remove-use-case.js";
import { ProjectPluginCleanup } from "../../../../../src/contexts/framework/application/ownership/project-plugin-cleanup.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import {
  errnoError,
  FaultingFileAdapter,
} from "../../../../helpers/ports/faulting-file-adapter.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";
import { KeepPrompter, ScriptedPrompter } from "../../../../helpers/ports/scripted-prompter.js";

const REF = "sample-plugin@real-catalog";
const OTHER = "other-plugin@other-catalog";
const NAME = "project-alias";

async function fixture() {
  const project = Manifest.create();
  project.addTool("codex", "1.0.0", []);
  project.addPlugin(
    "codex",
    InstalledPlugin.fromMetadata(
      "sample-plugin",
      "1.0.0",
      { kind: "local", path: "/fixture" },
      false,
      "project",
      NAME
    )
  );
  project.setNativeRegistrations("codex", {
    binary: "codex",
    marketplaces: [
      { alias: NAME, hostName: "real-catalog" },
      { alias: "other-alias", hostName: "other-catalog" },
    ],
    pluginRefs: [REF, OTHER],
  });
  const machine = Manifest.create();
  machine.addTool("codex", "1.0.0", []);
  machine.setNativeRegistrations("codex", {
    binary: "codex",
    marketplaces: [{ alias: NAME, hostName: "real-catalog" }],
    pluginRefs: [REF],
    pluginClaims: [{ ref: REF, dependents: ["/A", "/B"] }],
  });
  const projectRepo = new InMemoryManifestRepository(project);
  const machineRepo = new InMemoryManifestRepository(machine);
  const registry = new InMemoryMarketplaceRegistry();
  await registry.save(
    "/A",
    Marketplace.create({
      name: NAME,
      source: { kind: "github", repo: "owner/project-alias" },
      scope: "project",
      addedAt: "2026-09-01T00:00:00.000Z",
    })
  );
  const fs = new InMemoryFileAdapter();
  const useCase = new MarketplaceRemoveUseCase(
    new ProjectPluginCleanup(fs, machineRepo),
    projectRepo,
    registry,
    new KeepPrompter()
  );
  return { projectRepo, machineRepo, registry, fs, useCase };
}

describe("project marketplace removal against machine native claims", () => {
  it("retains A's projection and machine claim when its Cursor hooks cannot be read", async () => {
    const hooksPath = join("/A", ".cursor/hooks.json");
    const hooks = JSON.stringify({
      version: 1,
      hooks: { preToolUse: [{ command: "node ./.cursor/hooks/sample-plugin/pre.js" }] },
    });
    const fs = new FaultingFileAdapter();
    fs.setFile(hooksPath, hooks);
    fs.setFile(join("/A", ".cursor/hooks/sample-plugin/pre.js"), "A's hook");
    fs.setFile(join("/B", ".cursor/hooks.json"), hooks);
    const globalMcp = join(homedir(), ".cursor/plugins/local/sample-plugin/mcp.json");
    fs.setFile(globalMcp, "B's MCP");
    fs.failOn("readFile", hooksPath, errnoError("EACCES"));
    const project = Manifest.create();
    project.addTool("cursor", "1.0.0", []);
    project.addPlugin(
      "cursor",
      InstalledPlugin.fromJSON({
        name: "sample-plugin",
        source: { kind: "local", path: "/fixture" },
        version: "1.0.0",
        strict: false,
        files: {},
        scope: "user",
        marketplace: NAME,
        projectHooks: {
          entries: [
            {
              event: "preToolUse",
              command: "node ./.cursor/hooks/sample-plugin/pre.js",
              digest: createHash("md5")
                .update(JSON.stringify({ command: "node ./.cursor/hooks/sample-plugin/pre.js" }))
                .digest("hex"),
            },
          ],
          scripts: {
            ".cursor/hooks/sample-plugin/pre.js": createHash("md5")
              .update("A's hook")
              .digest("hex"),
          },
        },
      })
    );
    const machine = Manifest.create();
    machine.addTool("cursor", "1.0.0", []);
    machine.addPlugin(
      "cursor",
      InstalledPlugin.fromJSON({
        name: "sample-plugin",
        source: { kind: "local", path: "/fixture" },
        version: "1.0.0",
        strict: false,
        files: {},
        scope: "user",
        dependents: ["/A", "/B"],
      })
    );
    const projectRepo = new InMemoryManifestRepository(project);
    const machineRepo = new InMemoryManifestRepository(machine);
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      "/A",
      Marketplace.create({
        name: NAME,
        source: { kind: "local", path: "/fixture" },
        scope: "project",
        addedAt: "2026-09-15T00:00:00Z",
      })
    );
    const useCase = new MarketplaceRemoveUseCase(
      new ProjectPluginCleanup(fs, machineRepo),
      projectRepo,
      registry,
      new KeepPrompter()
    );

    await expect(
      useCase.execute({ name: NAME, projectRoot: "/A", autoConfirm: true })
    ).rejects.toThrow(/EACCES/);

    expect(projectRepo.saveCount).toBe(0);
    expect(projectRepo.getCurrent()?.getPlugins("cursor")).toHaveLength(1);
    expect(machineRepo.getCurrent()?.getPlugins("cursor")[0]?.dependents).toEqual(["/A", "/B"]);
    expect(fs.getFile(hooksPath)).toBe(hooks);
    expect(fs.getFile(globalMcp)).toBe("B's MCP");
    expect((await registry.list("/A")).some((entry) => entry.name === NAME)).toBe(true);
  });

  it("refuses user scope at the project use-case edge without touching a catalogue", async () => {
    const f = await fixture();
    await expect(
      f.useCase.execute({ name: NAME, projectRoot: "/A", autoConfirm: true, scope: "user" })
    ).rejects.toThrow(/User-scope marketplace removal requires/);
    expect((await f.registry.list("/A")).find((entry) => entry.name === NAME)).toBeDefined();
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
    ]);
  });

  it("removes only the project catalogue when its project manifest is absent", async () => {
    const f = await fixture();
    const useCase = new MarketplaceRemoveUseCase(
      new ProjectPluginCleanup(f.fs, f.machineRepo),
      new InMemoryManifestRepository(),
      f.registry,
      new KeepPrompter()
    );
    expect(
      await useCase.execute({ name: NAME, projectRoot: "/A", autoConfirm: true })
    ).toMatchObject({ removedPluginCount: 0, orphanCount: 0 });
    expect((await f.registry.list("/A")).find((entry) => entry.name === NAME)).toBeUndefined();
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
    ]);
  });

  it("deletes A's exact orphan projection but preserves B and a different host catalogue", async () => {
    const f = await fixture();
    expect(
      await f.useCase.execute({ name: NAME, projectRoot: "/A", autoConfirm: true })
    ).toMatchObject({ removedPluginCount: 1, orphanCount: 1 });
    expect(f.projectRepo.getCurrent()?.getPlugins("codex")).toEqual([]);
    expect(f.projectRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginRefs).toEqual([
      OTHER,
    ]);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/B"] },
    ]);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginRefs).toEqual([REF]);
    expect((await f.registry.list("/A")).find((entry) => entry.name === NAME)).toBeUndefined();
  });

  it("does not detach B or claim a ref after a local file deletion failure", async () => {
    class RefusingFileAdapter extends InMemoryFileAdapter {
      override async deleteFile(): Promise<void> {
        throw new Error("local file delete failed");
      }
    }
    const f = await fixture();
    const project = f.projectRepo.getCurrent();
    const plugin = project?.getPlugins("codex")[0];
    if (project === null || plugin === undefined) throw new Error("fixture missing plugin");
    project.updatePlugin("codex", plugin.withFiles(new Map([[".codex/skills/demo.md", "abc"]])));
    const useCase = new MarketplaceRemoveUseCase(
      new ProjectPluginCleanup(new RefusingFileAdapter(), f.machineRepo),
      f.projectRepo,
      f.registry,
      new KeepPrompter()
    );
    await expect(
      useCase.execute({ name: NAME, projectRoot: "/A", autoConfirm: true })
    ).rejects.toThrow(/local file delete failed/);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
    ]);
    expect((await f.registry.list("/A")).find((entry) => entry.name === NAME)).toBeDefined();
  });

  it("leaves a project plugin and B's machine claim when the operator declines orphan cleanup", async () => {
    const f = await fixture();
    const prompter = new ScriptedPrompter([{ type: "confirm", value: false }]);
    const useCase = new MarketplaceRemoveUseCase(
      new ProjectPluginCleanup(f.fs, f.machineRepo),
      f.projectRepo,
      f.registry,
      prompter
    );
    expect(
      await useCase.execute({ name: NAME, projectRoot: "/A", autoConfirm: false })
    ).toMatchObject({ removedPluginCount: 0, orphanCount: 1 });
    expect(f.projectRepo.getCurrent()?.getPlugins("codex")).toHaveLength(1);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
    ]);
  });

  it("releases only A's Cursor file claim, leaving B's user bytes intact", async () => {
    const project = Manifest.create();
    project.addTool("cursor", "1.0.0", []);
    project.addPlugin(
      "cursor",
      InstalledPlugin.fromJSON({
        name: "sample-plugin",
        source: { kind: "local", path: "/fixture" },
        version: "1.0.0",
        strict: false,
        files: {},
        scope: "user",
        marketplace: NAME,
        projectHooks: {
          entries: [
            {
              event: "preToolUse",
              command: "node ./.cursor/hooks/sample-plugin/pre.js",
              digest: createHash("md5")
                .update(JSON.stringify({ command: "node ./.cursor/hooks/sample-plugin/pre.js" }))
                .digest("hex"),
            },
          ],
          scripts: {
            ".cursor/hooks/sample-plugin/pre.js": createHash("md5")
              .update("A's hook")
              .digest("hex"),
          },
        },
      })
    );
    const machine = Manifest.create();
    machine.addTool("cursor", "1.0.0", []);
    machine.addPlugin(
      "cursor",
      InstalledPlugin.fromJSON({
        name: "sample-plugin",
        source: { kind: "local", path: "/fixture" },
        version: "1.0.0",
        strict: false,
        files: { "sample-plugin/skills/demo.md": "abc" },
        scope: "user",
        marketplace: NAME,
        dependents: ["/A", "/B"],
      })
    );
    const machineRepo = new InMemoryManifestRepository(machine);
    const projectRepo = new InMemoryManifestRepository(project);
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      "/A",
      Marketplace.create({
        name: NAME,
        source: { kind: "github", repo: "owner/project-alias" },
        scope: "project",
        addedAt: "2026-09-01T00:00:00.000Z",
      })
    );
    const hooks = JSON.stringify({
      version: 1,
      hooks: {
        preToolUse: [{ command: "node ./.cursor/hooks/sample-plugin/pre.js" }],
      },
    });
    const aHooks = join("/A", ".cursor/hooks.json");
    const bHooks = join("/B", ".cursor/hooks.json");
    const aScript = join("/A", ".cursor/hooks/sample-plugin/pre.js");
    const bScript = join("/B", ".cursor/hooks/sample-plugin/pre.js");
    const fs = new InMemoryFileAdapter({
      [aHooks]: hooks,
      [bHooks]: hooks,
      [aScript]: "A's hook",
      [bScript]: "B's hook",
    });
    const ownedPath = join(homedir(), ".cursor/plugins/local/sample-plugin/skills/demo.md");
    const ownedMcp = join(homedir(), ".cursor/plugins/local/sample-plugin/mcp.json");
    fs.setFile(ownedPath, "B's bytes");
    fs.setFile(ownedMcp, "B's MCP");
    const useCase = new MarketplaceRemoveUseCase(
      new ProjectPluginCleanup(fs, machineRepo),
      projectRepo,
      registry,
      new KeepPrompter()
    );
    expect(
      await useCase.execute({ name: NAME, projectRoot: "/A", autoConfirm: true })
    ).toMatchObject({
      removedPluginCount: 1,
    });
    expect(fs.getFile(ownedPath)).toBe("B's bytes");
    expect(fs.getFile(ownedMcp)).toBe("B's MCP");
    expect(fs.getFile(aHooks)).toBeUndefined();
    expect(fs.getFile(aScript)).toBeUndefined();
    expect(fs.getFile(bHooks)).toBe(hooks);
    expect(fs.getFile(bScript)).toBe("B's hook");
    expect(machineRepo.getCurrent()?.getPlugins("cursor")[0]?.dependents).toEqual(["/B"]);
    expect(projectRepo.getCurrent()?.getPlugins("cursor")).toEqual([]);
  });
});
