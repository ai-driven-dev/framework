import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import {
  FRAMEWORK_MARKETPLACE_NAME,
  Marketplace,
} from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { MarketplaceRemoveUseCase } from "../../../../../src/contexts/framework/application/flows/marketplace-remove-use-case.js";
import { ProjectPluginCleanup } from "../../../../../src/contexts/framework/application/ownership/project-plugin-cleanup.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import {
  InvalidMarketplaceNameError,
  MarketplaceNotFoundError,
} from "../../../../../src/kernel/errors.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";
import { KeepPrompter, ScriptedPrompter } from "../../../../helpers/ports/scripted-prompter.js";

const PROJECT_ROOT = "/test-project";

class ConfirmRecordingPrompter extends ScriptedPrompter {
  readonly confirmMessages: string[] = [];

  override async confirm(message: string, defaultValue?: boolean): Promise<boolean> {
    this.confirmMessages.push(message);
    return super.confirm(message, defaultValue);
  }
}

class SaveCountingManifestRepository extends InMemoryManifestRepository {
  saves = 0;

  override async save(manifest: Manifest): Promise<void> {
    this.saves += 1;
    return super.save(manifest);
  }
}

function marketplaceNamed(name: string): Marketplace {
  return Marketplace.create({
    name,
    source: { kind: "github", repo: `owner/${name}` },
    scope: "project",
    addedAt: "2026-04-29T10:00:00.000Z",
  });
}

function pluginFrom(marketplace: string, name: string): InstalledPlugin {
  return InstalledPlugin.fromMetadata(
    name,
    "1.0.0",
    { kind: "github", repo: `owner/${name}` },
    false,
    "project",
    marketplace
  );
}

function manifestWithPlugins(...plugins: readonly InstalledPlugin[]): Manifest {
  const manifest = Manifest.create();
  manifest.addTool("claude", "1.0.0", []);
  for (const plugin of plugins) manifest.addPlugin("claude", plugin);
  return manifest;
}

/** Records every path `deleteFile` is called with, so a test can prove where a plugin's
 * file actually got deleted from without inspecting private use-case state. */
class RecordingFileAdapter extends InMemoryFileAdapter {
  readonly deletedPaths: string[] = [];

  override async deleteFile(path: string): Promise<void> {
    this.deletedPaths.push(path);
    return super.deleteFile(path);
  }
}

function buildUseCase() {
  const hasher = new DeterministicHasher();
  const fs = new RecordingFileAdapter({}, hasher);
  const manifestRepo = new InMemoryManifestRepository();
  const registry = new InMemoryMarketplaceRegistry();
  const useCase = new MarketplaceRemoveUseCase(
    new ProjectPluginCleanup(fs),
    manifestRepo,
    registry,
    new KeepPrompter()
  );
  return { useCase, registry, manifestRepo, fs };
}

describe("MarketplaceRemoveUseCase", () => {
  it("throws MarketplaceNotFoundError when entry does not exist", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.execute({ name: "missing", projectRoot: PROJECT_ROOT, autoConfirm: true })
    ).rejects.toThrow(MarketplaceNotFoundError);
  });

  it("removes registry entry when no orphans tracked", async () => {
    const { useCase, registry } = buildUseCase();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "awesome",
        source: { kind: "local", path: "/tmp/whatever" },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(result.removedPluginCount).toBe(0);
    expect(await registry.list(PROJECT_ROOT)).toEqual([]);
  });

  it("removes orphan plugins and their files when autoConfirm is true", async () => {
    const { useCase, registry, manifestRepo, fs } = buildUseCase();
    const manifest = Manifest.create();
    manifest.addTool("claude", "1.0.0", []);
    const plugin = InstalledPlugin.fromJSON({
      name: "sample",
      source: { kind: "github", repo: "owner/sample" },
      version: "1.0.0",
      strict: false,
      files: { ".claude/plugins/sample/CLAUDE.md": "0123456789abcdef0123456789abcdef" },
      scope: "project",
      marketplace: "awesome",
    });
    manifest.addPlugin("claude", plugin);
    await manifestRepo.save(manifest);

    const filePath = join(PROJECT_ROOT, ".claude/plugins/sample/CLAUDE.md");
    await fs.writeFile(filePath, "content");

    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "awesome",
        source: { kind: "github", repo: "owner/awesome" },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(result.removedPluginCount).toBe(1);
    expect(fs.has(filePath)).toBe(false);
    const reloaded = await manifestRepo.load();
    expect(reloaded?.getPlugins("claude")).toHaveLength(0);
  });

  it("removes a project marketplace's orphan projection without deleting shared Cursor files", async () => {
    const { registry, manifestRepo, fs } = buildUseCase();
    const useCase = new MarketplaceRemoveUseCase(
      new ProjectPluginCleanup(fs),
      manifestRepo,
      registry,
      new KeepPrompter()
    );
    const manifest = Manifest.create();
    manifest.addTool("cursor", "1.0.0", []);
    const pluginKey = "aidd-context/commands/hello.md";
    manifest.addPlugin(
      "cursor",
      InstalledPlugin.fromJSON({
        name: "aidd-context",
        source: { kind: "github", repo: "owner/aidd-context" },
        version: "1.0.0",
        strict: false,
        files: { [pluginKey]: "0123456789abcdef0123456789abcdef" },
        scope: "user",
        marketplace: "awesome",
      })
    );
    await manifestRepo.save(manifest);

    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "awesome",
        source: { kind: "github", repo: "owner/awesome" },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(result.removedPluginCount).toBe(1);
    expect(
      fs.deletedPaths.some((p) => p.endsWith(join(".cursor", "plugins", "local", pluginKey)))
    ).toBe(false);
    expect(fs.deletedPaths).not.toContain(join(PROJECT_ROOT, pluginKey));
  });

  it("removes a cursor orphan's file under projectRoot, not ~/.cursor/plugins/local, when the manifest says scope: project", async () => {
    const { registry, manifestRepo, fs } = buildUseCase();
    const useCase = new MarketplaceRemoveUseCase(
      new ProjectPluginCleanup(fs),
      manifestRepo,
      registry,
      new KeepPrompter()
    );
    const manifest = Manifest.create();
    manifest.addTool("cursor", "1.0.0", []);
    const pluginKey = "aidd-context/commands/hello.md";
    manifest.addPlugin(
      "cursor",
      InstalledPlugin.fromJSON({
        name: "aidd-context",
        source: { kind: "github", repo: "owner/aidd-context" },
        version: "1.0.0",
        strict: false,
        files: { [pluginKey]: "0123456789abcdef0123456789abcdef" },
        // Disagrees with cursor's own profile, which declares installScope "user".
        scope: "project",
        marketplace: "awesome",
      })
    );
    await manifestRepo.save(manifest);

    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "awesome",
        source: { kind: "github", repo: "owner/awesome" },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(result.removedPluginCount).toBe(1);
    expect(fs.deletedPaths).toContain(join(PROJECT_ROOT, pluginKey));
    expect(fs.deletedPaths.some((p) => p.includes(join(".cursor", "plugins", "local")))).toBe(
      false
    );
  });

  // `aidd-framework` is machine-scope: removing it from one project would orphan the host's
  // own registration for every other project. `marketplace add` already refuses that name.
  it("refuses to remove the reserved aidd-framework marketplace, leaving the registry untouched", async () => {
    const { useCase, registry } = buildUseCase();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: FRAMEWORK_MARKETPLACE_NAME,
        source: { kind: "local", path: "." },
        scope: "user",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await expect(
      useCase.execute({
        name: FRAMEWORK_MARKETPLACE_NAME,
        projectRoot: PROJECT_ROOT,
        autoConfirm: true,
      })
    ).rejects.toThrow(InvalidMarketplaceNameError);

    const list = await registry.list(PROJECT_ROOT);
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe(FRAMEWORK_MARKETPLACE_NAME);
  });

  it("refuses the reserved name with a message naming the command that does remove it", async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        name: FRAMEWORK_MARKETPLACE_NAME,
        projectRoot: PROJECT_ROOT,
        autoConfirm: true,
      })
    ).rejects.toThrow(
      new InvalidMarketplaceNameError(
        '"aidd-framework" is shared by every project on this machine and is not removed with `aidd marketplace remove` — it is removed with the framework itself, by `aidd clean`, once machine scope lands there.'
      )
    );
  });
});

describe("which marketplace a removal takes out", () => {
  it("removes the named marketplace, never the first one registered", async () => {
    const { useCase, registry } = buildUseCase();
    await registry.save(PROJECT_ROOT, marketplaceNamed("alpha"));
    const awesome = marketplaceNamed("awesome");
    await registry.save(PROJECT_ROOT, awesome);

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(result).toStrictEqual({ marketplace: awesome, removedPluginCount: 0, orphanCount: 0 });
    expect((await registry.list(PROJECT_ROOT)).map((m) => m.name)).toStrictEqual(["alpha"]);
  });

  it("reports zero orphans when the project has no manifest at all", async () => {
    const { useCase, registry } = buildUseCase();
    const awesome = marketplaceNamed("awesome");
    await registry.save(PROJECT_ROOT, awesome);

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(result).toStrictEqual({ marketplace: awesome, removedPluginCount: 0, orphanCount: 0 });
  });
});

describe("which plugins a removal orphans", () => {
  it("keeps A and B Cursor claims when project hooks.json resolves outside the project", async () => {
    const hooksPath = join(PROJECT_ROOT, ".cursor/hooks.json");
    const foreignPath = "/foreign/hooks.json";
    const command = "node ./.cursor/hooks/sample/pre.js";
    const entry = { command };
    const content = JSON.stringify({ version: 1, hooks: { preToolUse: [entry] } });
    const fs = new InMemoryFileAdapter({ [hooksPath]: content, [foreignPath]: content });
    fs.setSymlink(hooksPath, foreignPath);
    const plugin = InstalledPlugin.fromJSON({
      name: "sample",
      source: { kind: "local", path: "/fixture" },
      version: "1.0.0",
      strict: false,
      files: {},
      scope: "user",
      marketplace: "awesome",
      projectHooks: {
        entries: [
          {
            event: "preToolUse",
            command,
            digest: createHash("md5").update(JSON.stringify(entry)).digest("hex"),
          },
        ],
        scripts: {},
      },
    });
    const project = Manifest.create();
    project.addTool("cursor", "1.0.0", []);
    project.addPlugin("cursor", plugin);
    const projectRepo = new InMemoryManifestRepository(project);
    const machine = Manifest.create();
    machine.addTool("cursor", "1.0.0", []);
    machine.addPlugin("cursor", plugin.withDependents([PROJECT_ROOT, "/B"]));
    const machineRepo = new InMemoryManifestRepository(machine);
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplaceNamed("awesome"));
    const useCase = new MarketplaceRemoveUseCase(
      new ProjectPluginCleanup(fs, machineRepo),
      projectRepo,
      registry,
      new KeepPrompter()
    );

    await expect(
      useCase.execute({ name: "awesome", projectRoot: PROJECT_ROOT, autoConfirm: true })
    ).rejects.toThrow(/outside.*project/);

    expect(projectRepo.getCurrent()?.getPlugins("cursor")).toHaveLength(1);
    expect(machineRepo.getCurrent()?.getPlugins("cursor")[0]?.dependents).toEqual([
      PROJECT_ROOT,
      "/B",
    ]);
    expect(fs.getFile(foreignPath)).toBe(content);
    expect((await registry.list(PROJECT_ROOT)).some((entry) => entry.name === "awesome")).toBe(
      true
    );
  });

  it("retains the OpenCode orphan and catalogue when MCP output is a symlink outside the project", async () => {
    const mcpPath = join(PROJECT_ROOT, "opencode.json");
    const foreignPath = "/foreign/opencode.json";
    const content = JSON.stringify({
      mcp: { mine: { type: "local" }, theirs: { type: "remote" } },
    });
    const fs = new InMemoryFileAdapter({ [mcpPath]: content, [foreignPath]: content });
    fs.setSymlink(mcpPath, foreignPath);
    const manifest = Manifest.create();
    manifest.addTool("opencode", "1.0.0", []);
    manifest.addPlugin(
      "opencode",
      InstalledPlugin.fromJSON({
        name: "sample",
        source: { kind: "local", path: "/fixture" },
        version: "1.0.0",
        strict: false,
        files: {},
        mcpEntries: {
          mine: new DeterministicHasher().hash(JSON.stringify({ type: "local" })).value,
        },
        scope: "project",
        marketplace: "awesome",
      })
    );
    const manifestRepo = new InMemoryManifestRepository(manifest);
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplaceNamed("awesome"));
    const useCase = new MarketplaceRemoveUseCase(
      new ProjectPluginCleanup(fs),
      manifestRepo,
      registry,
      new KeepPrompter()
    );

    await expect(
      useCase.execute({ name: "awesome", projectRoot: PROJECT_ROOT, autoConfirm: true })
    ).rejects.toThrow(/outside.*project|escapes.*project/);

    expect(manifestRepo.saveCount).toBe(0);
    expect(manifestRepo.getCurrent()?.getPlugins("opencode")).toHaveLength(1);
    expect(fs.getFile(foreignPath)).toBe(content);
    expect(fs.getFile(mcpPath)).toBe(content);
    expect((await registry.list(PROJECT_ROOT)).some((entry) => entry.name === "awesome")).toBe(
      true
    );
  });

  it("retains the OpenCode orphan and catalogue when its project MCP config cannot be rewritten", async () => {
    const mcpPath = join(PROJECT_ROOT, "opencode.json");
    const content = JSON.stringify({
      mcp: { mine: { type: "local" }, theirs: { type: "remote" } },
    });
    class RefusingMcpWriteAdapter extends InMemoryFileAdapter {
      override async writeFile(path: string, value: string): Promise<void> {
        if (path === mcpPath) throw new Error("MCP write refused");
        return super.writeFile(path, value);
      }
    }
    const fs = new RefusingMcpWriteAdapter({ [mcpPath]: content });
    const manifest = Manifest.create();
    manifest.addTool("opencode", "1.0.0", []);
    manifest.addPlugin(
      "opencode",
      InstalledPlugin.fromJSON({
        name: "sample",
        source: { kind: "local", path: "/fixture" },
        version: "1.0.0",
        strict: false,
        files: {},
        mcpEntries: {
          mine: new DeterministicHasher().hash(JSON.stringify({ type: "local" })).value,
        },
        scope: "project",
        marketplace: "awesome",
      })
    );
    const manifestRepo = new InMemoryManifestRepository(manifest);
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplaceNamed("awesome"));
    const useCase = new MarketplaceRemoveUseCase(
      new ProjectPluginCleanup(fs),
      manifestRepo,
      registry,
      new KeepPrompter()
    );

    await expect(
      useCase.execute({ name: "awesome", projectRoot: PROJECT_ROOT, autoConfirm: true })
    ).rejects.toThrow(/MCP write refused/);

    expect(manifestRepo.saveCount).toBe(0);
    expect(manifestRepo.getCurrent()?.getPlugins("opencode")).toHaveLength(1);
    expect(fs.getFile(mcpPath)).toBe(content);
    expect((await registry.list(PROJECT_ROOT)).some((entry) => entry.name === "awesome")).toBe(
      true
    );
  });

  it("unmerges only the orphan's contributed OpenCode MCP server from the project", async () => {
    const { useCase, registry, manifestRepo, fs } = buildUseCase();
    const manifest = Manifest.create();
    manifest.addTool("opencode", "1.0.0", []);
    manifest.addPlugin(
      "opencode",
      InstalledPlugin.fromJSON({
        name: "sample",
        source: { kind: "local", path: "/fixture" },
        version: "1.0.0",
        strict: false,
        files: {},
        mcpEntries: {
          mine: new DeterministicHasher().hash(JSON.stringify({ type: "local" })).value,
        },
        scope: "project",
        marketplace: "awesome",
      })
    );
    await manifestRepo.save(manifest);
    const mcpPath = join(PROJECT_ROOT, "opencode.json");
    fs.setFile(
      mcpPath,
      JSON.stringify({ mcp: { mine: { type: "local" }, theirs: { type: "remote" } } })
    );
    await registry.save(PROJECT_ROOT, marketplaceNamed("awesome"));

    fs.setFile(
      mcpPath,
      JSON.stringify({ mcp: { mine: { type: "user-edited" }, theirs: { type: "remote" } } })
    );
    await expect(
      useCase.execute({ name: "awesome", projectRoot: PROJECT_ROOT, autoConfirm: true })
    ).rejects.toThrow(/edited/);
    expect((await manifestRepo.load())?.getPlugins("opencode")).toHaveLength(1);
    expect((await registry.list(PROJECT_ROOT)).some((entry) => entry.name === "awesome")).toBe(
      true
    );
    fs.setFile(
      mcpPath,
      JSON.stringify({ mcp: { mine: { type: "local" }, theirs: { type: "remote" } } })
    );

    await useCase.execute({ name: "awesome", projectRoot: PROJECT_ROOT, autoConfirm: true });

    expect(JSON.parse(fs.getFile(mcpPath) ?? "null")).toEqual({
      mcp: { theirs: { type: "remote" } },
    });
    expect((await manifestRepo.load())?.getPlugins("opencode")).toEqual([]);
  });

  it("preflights every orphan before touching A when B's MCP contribution was edited", async () => {
    const { useCase, registry, manifestRepo, fs } = buildUseCase();
    const manifest = Manifest.create();
    manifest.addTool("opencode", "1.0.0", []);
    for (const name of ["alpha", "beta"]) {
      manifest.addPlugin(
        "opencode",
        InstalledPlugin.fromJSON({
          name,
          source: { kind: "local", path: "/fixture" },
          version: "1.0.0",
          strict: false,
          files: {},
          mcpEntries: {
            [name]: new DeterministicHasher().hash(JSON.stringify({ type: "local" })).value,
          },
          scope: "project",
          marketplace: "awesome",
        })
      );
    }
    await manifestRepo.save(manifest);
    await registry.save(PROJECT_ROOT, marketplaceNamed("awesome"));
    const path = join(PROJECT_ROOT, "opencode.json");
    const edited = JSON.stringify({
      mcp: { alpha: { type: "local" }, beta: { type: "user-edited" } },
    });
    fs.setFile(path, edited);
    await expect(
      useCase.execute({ name: "awesome", projectRoot: PROJECT_ROOT, autoConfirm: true })
    ).rejects.toThrow(/edited.*beta|beta.*edited/);
    expect(fs.getFile(path)).toBe(edited);
    expect((await manifestRepo.load())?.getPlugins("opencode").map((p) => p.name)).toEqual([
      "alpha",
      "beta",
    ]);
    expect((await registry.list(PROJECT_ROOT)).some((m) => m.name === "awesome")).toBe(true);
  });

  it("removes the marketplace's own plugins and leaves another marketplace's in place", async () => {
    const { useCase, registry, manifestRepo } = buildUseCase();
    await manifestRepo.save(
      manifestWithPlugins(pluginFrom("awesome", "sample"), pluginFrom("elsewhere", "other"))
    );
    const awesome = marketplaceNamed("awesome");
    await registry.save(PROJECT_ROOT, awesome);

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(result).toStrictEqual({ marketplace: awesome, removedPluginCount: 1, orphanCount: 1 });
    expect((await manifestRepo.load())?.getPlugins("claude").map((p) => p.name)).toStrictEqual([
      "other",
    ]);
  });

  it("keeps every orphan when the person declines the cleanup, and still drops the marketplace", async () => {
    const { registry, manifestRepo, fs } = buildUseCase();
    const prompter = new ConfirmRecordingPrompter([ScriptedPrompter.answer.confirm(false)]);
    const useCase = new MarketplaceRemoveUseCase(
      new ProjectPluginCleanup(fs),
      manifestRepo,
      registry,
      prompter
    );
    await manifestRepo.save(manifestWithPlugins(pluginFrom("awesome", "sample")));
    const awesome = marketplaceNamed("awesome");
    await registry.save(PROJECT_ROOT, awesome);

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: false,
    });

    expect(result).toStrictEqual({ marketplace: awesome, removedPluginCount: 0, orphanCount: 1 });
    expect((await manifestRepo.load())?.getPlugins("claude").map((p) => p.name)).toStrictEqual([
      "sample",
    ]);
    expect(await registry.list(PROJECT_ROOT)).toStrictEqual([]);
  });

  it("asks once, naming how many plugins the cleanup would remove", async () => {
    const { registry, manifestRepo, fs } = buildUseCase();
    const prompter = new ConfirmRecordingPrompter([ScriptedPrompter.answer.confirm(true)]);
    const useCase = new MarketplaceRemoveUseCase(
      new ProjectPluginCleanup(fs),
      manifestRepo,
      registry,
      prompter
    );
    await manifestRepo.save(
      manifestWithPlugins(pluginFrom("awesome", "sample"), pluginFrom("awesome", "second"))
    );
    await registry.save(PROJECT_ROOT, marketplaceNamed("awesome"));

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: false,
    });

    expect(prompter.confirmMessages).toStrictEqual([
      "Remove 2 plugin(s) installed from this marketplace?",
    ]);
    expect(result.removedPluginCount).toBe(2);
  });

  it("neither asks nor rewrites the manifest when nothing was installed from the marketplace", async () => {
    const { registry, fs } = buildUseCase();
    const manifestRepo = new SaveCountingManifestRepository(
      manifestWithPlugins(pluginFrom("elsewhere", "other"))
    );
    const prompter = new ConfirmRecordingPrompter([ScriptedPrompter.answer.confirm(true)]);
    const useCase = new MarketplaceRemoveUseCase(
      new ProjectPluginCleanup(fs),
      manifestRepo,
      registry,
      prompter
    );
    await registry.save(PROJECT_ROOT, marketplaceNamed("awesome"));

    await useCase.execute({ name: "awesome", projectRoot: PROJECT_ROOT, autoConfirm: false });

    expect(prompter.confirmMessages).toStrictEqual([]);
    expect(manifestRepo.saves).toBe(0);
  });

  it("cleans up without asking when the caller auto-confirms", async () => {
    const { registry, manifestRepo, fs } = buildUseCase();
    const prompter = new ConfirmRecordingPrompter([ScriptedPrompter.answer.confirm(false)]);
    const useCase = new MarketplaceRemoveUseCase(
      new ProjectPluginCleanup(fs),
      manifestRepo,
      registry,
      prompter
    );
    await manifestRepo.save(manifestWithPlugins(pluginFrom("awesome", "sample")));
    await registry.save(PROJECT_ROOT, marketplaceNamed("awesome"));

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(prompter.confirmMessages).toStrictEqual([]);
    expect(result.removedPluginCount).toBe(1);
  });
});
