import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { RemoveProjectPlugin } from "../../../src/contexts/installation/application/removal/remove-project-plugin.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { removalClaims } from "../../../src/contexts/machine-claims/application/removal-claims.js";
import type { RemoveProjectMarketplace } from "../../../src/orchestration/marketplace/remove-project-marketplace.js";
import { FileHash } from "../../../src/shared/domain/file.js";
import { InMemoryManifestRepository } from "../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../helpers/ports/in-memory-marketplace-registry.js";
import { errnoError, FaultingFileAdapter } from "../../shared/testing/faulting-file-adapter.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.js";
import { TOOL } from "../../shared/testing/registered-tools.js";
import { KeepPrompter, ScriptedPrompter } from "../../shared/testing/scripted-prompter.js";
import { projectMarketplaceRemover } from "../testing/project-marketplace-remover.js";

const { cursor, codex } = TOOL;

const REF = "sample-plugin@real-catalog";
const OTHER = "other-plugin@other-catalog";
const NAME = "project-alias";

/** Removes `NAME` from project `/A`, with only what a case changes. */
function remove(
  useCase: RemoveProjectMarketplace,
  overrides: { autoConfirm?: boolean; scope?: "user" } = {}
) {
  return useCase.execute({
    name: NAME,
    projectRoot: "/A",
    autoConfirm: true,
    ...overrides,
  });
}

async function fixture(options: { nativeMapping?: "absent" | "unrelated" } = {}) {
  const project = Manifest.create();
  project.addTool(codex, "1.0.0", []);
  project.addPlugin(
    codex,
    InstalledPlugin.fromMetadata(
      "sample-plugin",
      "1.0.0",
      { kind: "local", path: "/fixture" },
      false,
      "project",
      NAME
    )
  );
  if (options.nativeMapping !== "absent")
    project.setNativeRegistrations(codex, {
      binary: "codex",
      marketplaces: [
        { alias: "other-alias", hostName: "other-catalog" },
        ...(options.nativeMapping === "unrelated"
          ? []
          : [{ alias: NAME, hostName: "real-catalog" }]),
      ],
      pluginRefs: [REF, OTHER],
    });
  const machine = Manifest.create();
  machine.addTool(codex, "1.0.0", []);
  machine.setNativeRegistrations(codex, {
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
  const fs = new InMemoryFileAdapter({}, ["/A", "/B"]);
  const useCase = projectMarketplaceRemover(
    new RemoveProjectPlugin(fs, removalClaims(machineRepo, fs)),
    projectRepo,
    registry,
    new KeepPrompter()
  );
  return { projectRepo, machineRepo, registry, fs, useCase };
}

describe("project marketplace removal against machine native claims", () => {
  it.each(["absent", "unrelated"] as const)(
    "removes a local orphan with %s native mapping without guessing or detaching machine refs",
    async (nativeMapping) => {
      const f = await fixture({ nativeMapping });
      const before = f.projectRepo.getCurrent()?.getNativeRegistrations(codex);
      expect(await remove(f.useCase)).toMatchObject({ removedPluginCount: 1, orphanCount: 1 });
      expect(f.projectRepo.getCurrent()?.getPlugins(codex)).toEqual([]);
      expect(f.projectRepo.getCurrent()?.getNativeRegistrations(codex)).toEqual(before);
      expect(f.machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
        { ref: REF, dependents: ["/A", "/B"] },
      ]);
      expect(f.machineRepo.saveCount).toBe(0);
      expect(await f.registry.list("/A")).toEqual([]);
    }
  );

  it("does not detach machine claims when removing a project catalogue without orphans", async () => {
    const f = await fixture();
    f.projectRepo.getCurrent()?.removePlugin(codex, "sample-plugin");
    const before = f.projectRepo.getCurrent()?.getNativeRegistrations(codex);
    expect(await remove(f.useCase)).toMatchObject({ removedPluginCount: 0, orphanCount: 0 });
    expect(f.projectRepo.getCurrent()?.getNativeRegistrations(codex)).toEqual(before);
    expect(f.projectRepo.saveCount).toBe(0);
    expect(f.machineRepo.saveCount).toBe(0);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
    ]);
    expect(await f.registry.list("/A")).toEqual([]);
  });

  it("retains A's projection and machine claim when its Cursor hooks cannot be read", async () => {
    const hooksPath = join("/A", ".cursor/hooks.json");
    const hooks = JSON.stringify({
      version: 1,
      hooks: { preToolUse: [{ command: "node ./.cursor/hooks/sample-plugin/pre.js" }] },
    });
    const fs = new FaultingFileAdapter({}, ["/A", "/B"]);
    fs.setFile(hooksPath, hooks);
    fs.setFile(join("/A", ".cursor/hooks/sample-plugin/pre.js"), "A's hook");
    fs.setFile(join("/B", ".cursor/hooks.json"), hooks);
    const globalMcp = join(homedir(), ".cursor/plugins/local/sample-plugin/mcp.json");
    fs.setFile(globalMcp, "B's MCP");
    fs.failOn("readFile", hooksPath, errnoError("EACCES"));
    const project = Manifest.create();
    project.addTool(cursor, "1.0.0", []);
    project.addPlugin(
      cursor,
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
              digest: FileHash.of(
                JSON.stringify({ command: "node ./.cursor/hooks/sample-plugin/pre.js" })
              ).value,
            },
          ],
          scripts: {
            ".cursor/hooks/sample-plugin/pre.js": FileHash.of("A's hook").value,
          },
        },
      })
    );
    const machine = Manifest.create();
    machine.addTool(cursor, "1.0.0", []);
    machine.addPlugin(
      cursor,
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
    const useCase = projectMarketplaceRemover(
      new RemoveProjectPlugin(fs, removalClaims(machineRepo, fs)),
      projectRepo,
      registry,
      new KeepPrompter()
    );

    await expect(remove(useCase)).rejects.toThrow(/EACCES/);

    expect(projectRepo.saveCount).toBe(0);
    expect(projectRepo.getCurrent()?.getPlugins(cursor)).toHaveLength(1);
    expect(machineRepo.getCurrent()?.getPlugins(cursor)[0]?.dependents).toEqual(["/A", "/B"]);
    expect(fs.getFile(hooksPath)).toBe(hooks);
    expect(fs.getFile(globalMcp)).toBe("B's MCP");
    expect((await registry.list("/A")).some((entry) => entry.name === NAME)).toBe(true);
  });

  it("refuses user scope at the project use-case edge without touching a catalogue", async () => {
    const f = await fixture();
    await expect(remove(f.useCase, { scope: "user" })).rejects.toThrow(
      /User-scope marketplace removal requires/
    );
    expect((await f.registry.list("/A")).find((entry) => entry.name === NAME)).toBeDefined();
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
    ]);
  });

  it("removes only the project catalogue when its project manifest is absent", async () => {
    const f = await fixture();
    const useCase = projectMarketplaceRemover(
      new RemoveProjectPlugin(f.fs, removalClaims(f.machineRepo, f.fs)),
      new InMemoryManifestRepository(),
      f.registry,
      new KeepPrompter()
    );
    expect(await remove(useCase)).toMatchObject({ removedPluginCount: 0, orphanCount: 0 });
    expect((await f.registry.list("/A")).find((entry) => entry.name === NAME)).toBeUndefined();
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
    ]);
  });

  it("deletes A's exact orphan projection but preserves B and a different host catalogue", async () => {
    const f = await fixture();
    expect(await remove(f.useCase)).toMatchObject({ removedPluginCount: 1, orphanCount: 1 });
    expect(f.projectRepo.getCurrent()?.getPlugins(codex)).toEqual([]);
    expect(f.projectRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginRefs).toEqual([OTHER]);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/B"] },
    ]);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginRefs).toEqual([REF]);
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
    const plugin = project?.getPlugins(codex)[0];
    if (project === null || plugin === undefined) throw new Error("fixture missing plugin");
    project.updatePlugin(codex, plugin.withFiles(new Map([[".codex/skills/demo.md", "abc"]])));
    const useCase = projectMarketplaceRemover(
      new RemoveProjectPlugin(
        new RefusingFileAdapter(),
        removalClaims(f.machineRepo, new RefusingFileAdapter())
      ),
      f.projectRepo,
      f.registry,
      new KeepPrompter()
    );
    await expect(remove(useCase)).rejects.toThrow(/local file delete failed/);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
    ]);
    expect((await f.registry.list("/A")).find((entry) => entry.name === NAME)).toBeDefined();
  });

  it("leaves a project plugin and B's machine claim when the operator declines orphan cleanup", async () => {
    const f = await fixture();
    const prompter = new ScriptedPrompter([{ type: "confirm", value: false }]);
    const useCase = projectMarketplaceRemover(
      new RemoveProjectPlugin(f.fs, removalClaims(f.machineRepo, f.fs)),
      f.projectRepo,
      f.registry,
      prompter
    );
    expect(await remove(useCase, { autoConfirm: false })).toMatchObject({
      removedPluginCount: 0,
      orphanCount: 1,
    });
    expect(f.projectRepo.getCurrent()?.getPlugins(codex)).toHaveLength(1);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
    ]);
  });

  it("releases only A's Cursor file claim, leaving B's user bytes intact", async () => {
    const project = Manifest.create();
    project.addTool(cursor, "1.0.0", []);
    project.addPlugin(
      cursor,
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
              digest: FileHash.of(
                JSON.stringify({ command: "node ./.cursor/hooks/sample-plugin/pre.js" })
              ).value,
            },
          ],
          scripts: {
            ".cursor/hooks/sample-plugin/pre.js": FileHash.of("A's hook").value,
          },
        },
      })
    );
    const machine = Manifest.create();
    machine.addTool(cursor, "1.0.0", []);
    machine.addPlugin(
      cursor,
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
    const fs = new InMemoryFileAdapter(
      {
        [aHooks]: hooks,
        [bHooks]: hooks,
        [aScript]: "A's hook",
        [bScript]: "B's hook",
        "/A/package.json": "{}",
      },
      ["/A", "/B"]
    );
    const ownedPath = join(homedir(), ".cursor/plugins/local/sample-plugin/skills/demo.md");
    const ownedMcp = join(homedir(), ".cursor/plugins/local/sample-plugin/mcp.json");
    fs.setFile(ownedPath, "B's bytes");
    fs.setFile(ownedMcp, "B's MCP");
    const useCase = projectMarketplaceRemover(
      new RemoveProjectPlugin(fs, removalClaims(machineRepo, fs)),
      projectRepo,
      registry,
      new KeepPrompter()
    );
    expect(await remove(useCase)).toMatchObject({ removedPluginCount: 1 });
    expect(fs.getFile(ownedPath)).toBe("B's bytes");
    expect(fs.getFile(ownedMcp)).toBe("B's MCP");
    expect(fs.getFile(aHooks)).toBeUndefined();
    expect(fs.getFile(aScript)).toBeUndefined();
    expect(fs.getFile(bHooks)).toBe(hooks);
    expect(fs.getFile(bScript)).toBe("B's hook");
    expect(machineRepo.getCurrent()?.getPlugins(cursor)[0]?.dependents).toEqual(["/B"]);
    expect(projectRepo.getCurrent()?.getPlugins(cursor)).toEqual([]);
  });
});
