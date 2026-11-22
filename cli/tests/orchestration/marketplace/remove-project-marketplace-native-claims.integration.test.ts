import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { RemoveProjectPlugin } from "../../../src/contexts/installation/application/removal/remove-project-plugin.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { RegistrationRecords } from "../../../src/contexts/installation/ports/record/registration-records.js";
import { removalClaims } from "../../../src/contexts/machine-claims/application/removal-claims.js";
import type { RemoveProjectMarketplace } from "../../../src/orchestration/marketplace/remove-project-marketplace.use-case.js";
import { FileHash } from "../../../src/shared/domain/file-hash.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import {
  errnoError,
  FaultingFileAdapter,
} from "../../shared/testing/faulting-file-adapter.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { KeepPrompter, ScriptedPrompter } from "../../shared/testing/scripted-prompter.fake.js";
import {
  SYNTHETIC_NATIVE_TOOL,
  SYNTHETIC_USER_PLUGINS,
  SYNTHETIC_USER_TOOL,
  syntheticNativeFamilyCatalog,
} from "../../shared/testing/synthetic-native-tool.builder.js";
import { projectMarketplaceRemover } from "../testing/project-marketplace-remover.builder.js";

const HOOKS_FILE = `.${SYNTHETIC_USER_TOOL}/hooks.json`;
const PLUGIN_HOME = join(SYNTHETIC_USER_PLUGINS(homedir()), "sample-plugin");
const PRE_SCRIPT = `.${SYNTHETIC_USER_TOOL}/hooks/sample-plugin/pre.js`;
const PRE_COMMAND = `node ./${PRE_SCRIPT}`;
const PROJECT_HOOKS = {
  entries: [
    {
      event: "preToolUse",
      command: PRE_COMMAND,
      digest: FileHash.of(JSON.stringify({ command: PRE_COMMAND })).value,
    },
  ],
  scripts: { [PRE_SCRIPT]: FileHash.of("A's hook").value },
};

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
  const project = aManifest()
    .withTool(SYNTHETIC_NATIVE_TOOL, [])
    .withPlugin(
      SYNTHETIC_NATIVE_TOOL,
      RecordedPlugin.fromMetadata({
        name: "sample-plugin",
        version: "1.0.0",
        source: { kind: "local", path: "/fixture" },
        strict: false,
        scope: "project",
        marketplace: NAME,
      })
    )
    .build();
  const projectRecords: RegistrationRecords = new Map();
  if (options.nativeMapping !== "absent")
    projectRecords.set(SYNTHETIC_NATIVE_TOOL, {
      binary: SYNTHETIC_NATIVE_TOOL,
      marketplaces: [
        { alias: "other-alias", hostName: "other-catalog" },
        ...(options.nativeMapping === "unrelated"
          ? []
          : [{ alias: NAME, hostName: "real-catalog" }]),
      ],
      pluginRefs: [REF, OTHER],
    });
  const machine = Manifest.create();
  machine.addTool(SYNTHETIC_NATIVE_TOOL, "1.0.0", []);
  const machineRecords: RegistrationRecords = new Map([
    [
      SYNTHETIC_NATIVE_TOOL,
      {
        binary: SYNTHETIC_NATIVE_TOOL,
        marketplaces: [{ alias: NAME, hostName: "real-catalog" }],
        pluginRefs: [REF],
        pluginClaims: [{ ref: REF, dependents: ["/A", "/B"] }],
      },
    ],
  ]);
  const projectRepo = new InMemoryManifestRepository(project, undefined, projectRecords);
  const machineRepo = new InMemoryManifestRepository(machine, undefined, machineRecords);
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
    syntheticNativeFamilyCatalog(),
    new RemoveProjectPlugin(fs, () => "/home/dev", removalClaims(machineRepo, fs)),
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
      const before = structuredClone(f.projectRepo.records.get(SYNTHETIC_NATIVE_TOOL));
      expect(await remove(f.useCase)).toMatchObject({ removedPluginCount: 1, orphanCount: 1 });
      expect(f.projectRepo.getCurrent()?.getRecordedPlugins(SYNTHETIC_NATIVE_TOOL)).toEqual([]);
      expect(f.projectRepo.records.get(SYNTHETIC_NATIVE_TOOL)).toEqual(before);
      expect(f.machineRepo.records.get(SYNTHETIC_NATIVE_TOOL)?.pluginClaims).toEqual([
        { ref: REF, dependents: ["/A", "/B"] },
      ]);
      expect(f.machineRepo.saveCount).toBe(0);
      expect(f.machineRepo.recordSaveCount).toBe(0);
      expect(await f.registry.list("/A")).toEqual([]);
    }
  );

  it("does not detach machine claims when removing a project catalogue without orphans", async () => {
    const f = await fixture();
    f.projectRepo.getCurrent()?.removePlugin(SYNTHETIC_NATIVE_TOOL, "sample-plugin");
    const before = structuredClone(f.projectRepo.records.get(SYNTHETIC_NATIVE_TOOL));
    expect(await remove(f.useCase)).toMatchObject({ removedPluginCount: 0, orphanCount: 0 });
    expect(f.projectRepo.records.get(SYNTHETIC_NATIVE_TOOL)).toEqual(before);
    expect(f.projectRepo.saveCount).toBe(0);
    expect(f.projectRepo.recordSaveCount).toBe(0);
    expect(f.machineRepo.saveCount).toBe(0);
    expect(f.machineRepo.recordSaveCount).toBe(0);
    expect(f.machineRepo.records.get(SYNTHETIC_NATIVE_TOOL)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
    ]);
    expect(await f.registry.list("/A")).toEqual([]);
  });

  it("retains A's projection and machine claim when its user-tool hooks cannot be read", async () => {
    const hooksPath = join("/A", HOOKS_FILE);
    const hooks = JSON.stringify({
      version: 1,
      hooks: { preToolUse: [{ command: `node ./${PRE_SCRIPT}` }] },
    });
    const fs = new FaultingFileAdapter({}, ["/A", "/B"]);
    fs.setFile(hooksPath, hooks);
    fs.setFile(join("/A", PRE_SCRIPT), "A's hook");
    fs.setFile(join("/B", HOOKS_FILE), hooks);
    const globalMcp = join(PLUGIN_HOME, "mcp.json");
    fs.setFile(globalMcp, "B's MCP");
    fs.failOn("readFile", hooksPath, errnoError("EACCES"));
    const project = aManifest()
      .withTool(SYNTHETIC_USER_TOOL, [])
      .withPlugin(
        SYNTHETIC_USER_TOOL,
        RecordedPlugin.fromJSON({
          name: "sample-plugin",
          source: { kind: "local", path: "/fixture" },
          version: "1.0.0",
          strict: false,
          files: {},
          scope: "user",
          marketplace: NAME,
          projectHooks: PROJECT_HOOKS,
        })
      )
      .build();
    const machine = aManifest()
      .withTool(SYNTHETIC_USER_TOOL, [])
      .withPlugin(
        SYNTHETIC_USER_TOOL,
        RecordedPlugin.fromJSON({
          name: "sample-plugin",
          source: { kind: "local", path: "/fixture" },
          version: "1.0.0",
          strict: false,
          files: {},
          scope: "user",
          dependents: ["/A", "/B"],
        })
      )
      .build();
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
      syntheticNativeFamilyCatalog(),
      new RemoveProjectPlugin(fs, () => "/home/dev", removalClaims(machineRepo, fs)),
      projectRepo,
      registry,
      new KeepPrompter()
    );

    await expect(remove(useCase)).rejects.toThrow(/EACCES/);

    expect(projectRepo.saveCount).toBe(0);
    expect(projectRepo.recordSaveCount).toBe(0);
    expect(projectRepo.getCurrent()?.getRecordedPlugins(SYNTHETIC_USER_TOOL)).toHaveLength(1);
    expect(
      machineRepo.getCurrent()?.getRecordedPlugins(SYNTHETIC_USER_TOOL)[0]?.machineClaim
    ).toEqual(["/A", "/B"]);
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
    expect(f.machineRepo.records.get(SYNTHETIC_NATIVE_TOOL)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
    ]);
  });

  it("removes only the project catalogue when its project manifest is absent", async () => {
    const f = await fixture();
    const useCase = projectMarketplaceRemover(
      syntheticNativeFamilyCatalog(),
      new RemoveProjectPlugin(f.fs, () => "/home/dev", removalClaims(f.machineRepo, f.fs)),
      new InMemoryManifestRepository(),
      f.registry,
      new KeepPrompter()
    );
    expect(await remove(useCase)).toMatchObject({ removedPluginCount: 0, orphanCount: 0 });
    expect((await f.registry.list("/A")).find((entry) => entry.name === NAME)).toBeUndefined();
    expect(f.machineRepo.records.get(SYNTHETIC_NATIVE_TOOL)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
    ]);
  });

  it("deletes A's exact orphan projection but preserves B and a different host catalogue", async () => {
    const f = await fixture();
    expect(await remove(f.useCase)).toMatchObject({ removedPluginCount: 1, orphanCount: 1 });
    expect(f.projectRepo.getCurrent()?.getRecordedPlugins(SYNTHETIC_NATIVE_TOOL)).toEqual([]);
    expect(f.projectRepo.records.get(SYNTHETIC_NATIVE_TOOL)?.pluginRefs).toEqual([OTHER]);
    expect(f.machineRepo.records.get(SYNTHETIC_NATIVE_TOOL)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/B"] },
    ]);
    expect(f.machineRepo.records.get(SYNTHETIC_NATIVE_TOOL)?.pluginRefs).toEqual([REF]);
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
    const plugin = project?.getRecordedPlugins(SYNTHETIC_NATIVE_TOOL)[0];
    if (project === null || plugin === undefined) throw new Error("fixture missing plugin");
    project.updatePlugin(
      SYNTHETIC_NATIVE_TOOL,
      plugin.withFiles(new Map([[`.${SYNTHETIC_NATIVE_TOOL}/skills/demo.md`, "abc"]]))
    );
    const useCase = projectMarketplaceRemover(
      syntheticNativeFamilyCatalog(),
      new RemoveProjectPlugin(
        new RefusingFileAdapter(),
        () => "/home/dev",
        removalClaims(f.machineRepo, new RefusingFileAdapter())
      ),
      f.projectRepo,
      f.registry,
      new KeepPrompter()
    );
    await expect(remove(useCase)).rejects.toThrow(/local file delete failed/);
    expect(f.machineRepo.records.get(SYNTHETIC_NATIVE_TOOL)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
    ]);
    expect((await f.registry.list("/A")).find((entry) => entry.name === NAME)).toBeDefined();
  });

  it("leaves a project plugin and B's machine claim when the operator declines orphan cleanup", async () => {
    const f = await fixture();
    const prompter = new ScriptedPrompter([{ type: "confirm", value: false }]);
    const useCase = projectMarketplaceRemover(
      syntheticNativeFamilyCatalog(),
      new RemoveProjectPlugin(f.fs, () => "/home/dev", removalClaims(f.machineRepo, f.fs)),
      f.projectRepo,
      f.registry,
      prompter
    );
    expect(await remove(useCase, { autoConfirm: false })).toMatchObject({
      removedPluginCount: 0,
      orphanCount: 1,
    });
    expect(f.projectRepo.getCurrent()?.getRecordedPlugins(SYNTHETIC_NATIVE_TOOL)).toHaveLength(1);
    expect(f.machineRepo.records.get(SYNTHETIC_NATIVE_TOOL)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
    ]);
  });

  it("releases only A's user-scope file claim, leaving B's user bytes intact", async () => {
    const project = aManifest()
      .withTool(SYNTHETIC_USER_TOOL, [])
      .withPlugin(
        SYNTHETIC_USER_TOOL,
        RecordedPlugin.fromJSON({
          name: "sample-plugin",
          source: { kind: "local", path: "/fixture" },
          version: "1.0.0",
          strict: false,
          files: {},
          scope: "user",
          marketplace: NAME,
          projectHooks: PROJECT_HOOKS,
        })
      )
      .build();
    const machine = aManifest()
      .withTool(SYNTHETIC_USER_TOOL, [])
      .withPlugin(
        SYNTHETIC_USER_TOOL,
        RecordedPlugin.fromJSON({
          name: "sample-plugin",
          source: { kind: "local", path: "/fixture" },
          version: "1.0.0",
          strict: false,
          files: { "sample-plugin/skills/demo.md": "abc" },
          scope: "user",
          marketplace: NAME,
          dependents: ["/A", "/B"],
        })
      )
      .build();
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
        preToolUse: [{ command: `node ./${PRE_SCRIPT}` }],
      },
    });
    const aHooks = join("/A", HOOKS_FILE);
    const bHooks = join("/B", HOOKS_FILE);
    const aScript = join("/A", PRE_SCRIPT);
    const bScript = join("/B", PRE_SCRIPT);
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
    const ownedPath = join(PLUGIN_HOME, "skills/demo.md");
    const ownedMcp = join(PLUGIN_HOME, "mcp.json");
    fs.setFile(ownedPath, "B's bytes");
    fs.setFile(ownedMcp, "B's MCP");
    const useCase = projectMarketplaceRemover(
      syntheticNativeFamilyCatalog(),
      new RemoveProjectPlugin(fs, () => "/home/dev", removalClaims(machineRepo, fs)),
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
    expect(
      machineRepo.getCurrent()?.getRecordedPlugins(SYNTHETIC_USER_TOOL)[0]?.machineClaim
    ).toEqual(["/B"]);
    expect(projectRepo.getCurrent()?.getRecordedPlugins(SYNTHETIC_USER_TOOL)).toEqual([]);
  });
});
