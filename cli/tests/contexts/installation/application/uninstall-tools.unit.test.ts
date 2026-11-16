import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type DetachProjectClaims,
  UninstallTools,
} from "../../../../src/contexts/installation/application/uninstall-tools.js";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { detachProjectClaims } from "../../../../src/contexts/machine-claims/application/detach-project-claims.js";
import {
  InputRequiredError,
  NoManifestError,
  ToolNotInstalledError,
} from "../../../../src/shared/domain/errors.js";
import { type FileHash, InstallationFile } from "../../../../src/shared/domain/file.js";
import type { MergeFileEntry } from "../../../../src/shared/domain/merge.js";
import type { ToolId } from "../../../../src/shared/domain/tool.js";
import type { FileReader } from "../../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../../src/shared/ports/file-writer.js";
import type { Logger } from "../../../../src/shared/ports/logger.js";
import { buildUnitDeps, initProject, installTool } from "../../../helpers/ports/build-unit-deps.js";
import { CapturingLogger } from "../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../helpers/ports/deterministic-hasher.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../helpers/ports/in-memory-manifest-repository.js";
import { catalogOf, TOOL } from "../../tools/testing/catalog-of.js";

const PROJECT_ROOT = "/test-project";
const SETTINGS_FILE = join(PROJECT_ROOT, ".vscode/settings.json");
const EXTENSIONS = join(PROJECT_ROOT, ".vscode/extensions.json");

const noClaims: DetachProjectClaims = async () => undefined;

function uninstaller(
  fs: FileReader & FileWriter,
  manifestRepo: InMemoryManifestRepository,
  logger: Logger = new CapturingLogger(),
  detachClaims: DetachProjectClaims = noClaims
): UninstallTools {
  return new UninstallTools(fs, logger, manifestRepo, detachClaims);
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

// Cursor Mode B: the file key is base-relative, resolved against the user plugins dir.
const PLUGIN_KEY = "aidd-context/commands/hello.md";

describe("UninstallTools — cursor plugin file (user-scope)", () => {
  it("does not delete a machine-owned user-scope plugin while uninstalling a project tool", async () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "1.0.0", []);
    manifest.addPlugin(
      TOOL.cursor,
      InstalledPlugin.fromJSON({
        name: "aidd-context",
        source: { kind: "local", path: "/some/path" },
        version: "1.0.0",
        strict: false,
        files: { [PLUGIN_KEY]: "abc123abc123abc123abc123abc123ab" },
        scope: "user",
      })
    );

    const fs = new RecordingFileAdapter();
    await uninstaller(fs, new InMemoryManifestRepository(manifest)).execute({
      tools: catalogOf(),
      toolIds: [TOOL.cursor],
      projectRoot: PROJECT_ROOT,
    });

    expect(
      fs.deletedPaths.some((p) => p.endsWith(join(".cursor", "plugins", "local", PLUGIN_KEY)))
    ).toBe(false);
    expect(fs.deletedPaths).not.toContain(join(PROJECT_ROOT, PLUGIN_KEY));
  });
});

const hasher = new DeterministicHasher();
const SETTINGS = ".claude/settings.json";
const AGENTS = "AGENTS.md";
const MCP = ".mcp.json";

function tracked(relativePath: string, content: string): InstallationFile {
  return new InstallationFile({ relativePath, content: "", hash: hasher.hash(content) });
}

function merging(
  relativePath: string,
  values: Record<string, unknown>,
  sectionKey: string | null = null
): MergeFileEntry {
  const entries: Record<string, FileHash> = {};
  for (const [key, value] of Object.entries(values)) {
    entries[key] = hasher.hash(JSON.stringify(value));
  }
  return { relativePath, sectionKey, entries };
}

function project(seed: Record<string, string>): { fs: InMemoryFileAdapter; manifest: Manifest } {
  const absolute: Record<string, string> = {};
  for (const [relativePath, content] of Object.entries(seed)) {
    absolute[join(PROJECT_ROOT, relativePath)] = content;
  }
  return { fs: new InMemoryFileAdapter(absolute, hasher), manifest: Manifest.create() };
}

function remove(
  target: { fs: InMemoryFileAdapter; manifest: Manifest },
  toolIds: ToolId[],
  logger = new CapturingLogger()
) {
  return uninstaller(target.fs, new InMemoryManifestRepository(target.manifest), logger).execute({
    tools: catalogOf(),
    toolIds,
    projectRoot: PROJECT_ROOT,
  });
}

describe("UninstallTools — regular files", () => {
  it("removes all project-scoped plugin files while preserving unrelated plugin content", async () => {
    const first = ".claude/plugins/project-plugin/skills/demo/SKILL.md";
    const second = ".claude/plugins/project-plugin/commands/demo.md";
    const neighbor = ".codex/plugins/other-plugin/skills/demo/SKILL.md";
    const target = project({ [first]: "skill", [second]: "command", [neighbor]: "other plugin" });
    target.manifest.addTool(TOOL.claude, "test", []);
    target.manifest.addTool(TOOL.codex, "test", []);
    target.manifest.addPlugin(
      TOOL.claude,
      InstalledPlugin.fromJSON({
        name: "project-plugin",
        source: { kind: "local", path: "/plugins/project-plugin" },
        version: "1.0.0",
        strict: false,
        scope: "project",
        files: { [first]: hasher.hash("skill").value, [second]: hasher.hash("command").value },
      })
    );

    const result = await remove(target, [TOOL.claude]);

    expect(target.fs.getFile(join(PROJECT_ROOT, first))).toBeUndefined();
    expect(target.fs.getFile(join(PROJECT_ROOT, second))).toBeUndefined();
    expect(target.fs.getFile(join(PROJECT_ROOT, neighbor))).toBe("other plugin");
    expect(target.manifest.hasTool(TOOL.claude)).toBe(false);
    expect(target.manifest.hasTool(TOOL.codex)).toBe(true);
    expect(result).toStrictEqual([{ toolId: TOOL.claude, fileCount: 0, deletedFiles: [] }]);
  });

  it("announces each tool it removes", async () => {
    const target = project({});
    target.manifest.addTool(TOOL.claude, "test", []);
    const logger = new CapturingLogger();

    await remove(target, [TOOL.claude], logger);

    expect(logger.infoMessages).toStrictEqual(["Removing claude files..."]);
  });

  it("deletes the files a tool tracks and reports them, then forgets the tool", async () => {
    const target = project({ [SETTINGS]: "{}", [AGENTS]: "# Agents" });
    target.manifest.addTool(TOOL.claude, "test", [
      tracked(SETTINGS, "{}"),
      tracked(AGENTS, "# Agents"),
    ]);

    const results = await remove(target, [TOOL.claude]);

    expect(results).toStrictEqual([
      { toolId: TOOL.claude, fileCount: 2, deletedFiles: [SETTINGS, AGENTS] },
    ]);
    expect(target.fs.listAll()).toStrictEqual([]);
    expect(target.manifest.hasTool(TOOL.claude)).toBe(false);
  });

  it("keeps a file another installed tool still tracks", async () => {
    const target = project({ [SETTINGS]: "{}", [AGENTS]: "# Agents" });
    target.manifest.addTool(TOOL.claude, "test", [
      tracked(SETTINGS, "{}"),
      tracked(AGENTS, "# Agents"),
    ]);
    target.manifest.addTool(TOOL.codex, "test", [tracked(AGENTS, "# Agents")]);

    const results = await remove(target, [TOOL.claude]);

    expect(results).toStrictEqual([
      { toolId: TOOL.claude, fileCount: 1, deletedFiles: [SETTINGS] },
    ]);
    expect(target.fs.has(join(PROJECT_ROOT, AGENTS))).toBe(true);
  });

  it("deletes a file shared only between the tools removed together", async () => {
    const target = project({ [AGENTS]: "# Agents" });
    target.manifest.addTool(TOOL.claude, "test", [tracked(AGENTS, "# Agents")]);
    target.manifest.addTool(TOOL.codex, "test", [tracked(AGENTS, "# Agents")]);

    const results = await remove(target, [TOOL.claude, TOOL.codex]);

    expect(results).toStrictEqual([
      { toolId: TOOL.claude, fileCount: 1, deletedFiles: [AGENTS] },
      { toolId: TOOL.codex, fileCount: 1, deletedFiles: [AGENTS] },
    ]);
    expect(target.fs.has(join(PROJECT_ROOT, AGENTS))).toBe(false);
  });

  it("keeps a file another installed tool merges into", async () => {
    const target = project({ [MCP]: '{"hub":{}}' });
    target.manifest.addTool(TOOL.claude, "test", [tracked(MCP, '{"hub":{}}')]);
    target.manifest.addTool(TOOL.codex, "test", [], [merging(MCP, { hub: {} })]);

    const results = await remove(target, [TOOL.claude]);

    expect(results).toStrictEqual([{ toolId: TOOL.claude, fileCount: 0, deletedFiles: [] }]);
    expect(target.fs.has(join(PROJECT_ROOT, MCP))).toBe(true);
  });
});

describe("UninstallTools — merge files", () => {
  const HUB = { command: "hub" };
  const PLAYWRIGHT = { command: "npx" };

  it("deletes a merge file an AI tool alone owns, even one it cannot parse", async () => {
    const target = project({ [MCP]: "not json" });
    target.manifest.addTool(TOOL.claude, "test", [], [merging(MCP, { hub: HUB })]);

    const results = await remove(target, [TOOL.claude]);

    expect(results).toStrictEqual([{ toolId: TOOL.claude, fileCount: 1, deletedFiles: [MCP] }]);
    expect(target.fs.has(join(PROJECT_ROOT, MCP))).toBe(false);
  });

  it("deletes a section-scoped merge file an AI tool alone owns even when it tracks no key in it", async () => {
    const target = project({ [MCP]: '{"x":1}', "codex.json": "{}" });
    target.manifest.addTool(TOOL.claude, "test", [], [merging(MCP, {}, "mcpServers")]);
    target.manifest.addTool(TOOL.codex, "test", [], [merging("codex.json", {})]);

    const results = await remove(target, [TOOL.claude]);

    expect(results).toStrictEqual([{ toolId: TOOL.claude, fileCount: 1, deletedFiles: [MCP] }]);
    expect(target.fs.has(join(PROJECT_ROOT, MCP))).toBe(false);
  });

  it("strips its own keys from a merge file a remaining tool owns and does not count it", async () => {
    const target = project({ [MCP]: JSON.stringify({ hub: HUB, playwright: PLAYWRIGHT }) });
    target.manifest.addTool(TOOL.claude, "test", [], [merging(MCP, { hub: HUB })]);
    target.manifest.addTool(
      TOOL.codex,
      "test",
      [],
      [merging("codex.json", {}), merging(MCP, { playwright: PLAYWRIGHT })]
    );

    const results = await remove(target, [TOOL.claude]);

    expect(results).toStrictEqual([{ toolId: TOOL.claude, fileCount: 0, deletedFiles: [] }]);
    expect(JSON.parse(target.fs.getFile(join(PROJECT_ROOT, MCP)) ?? "")).toStrictEqual({
      playwright: PLAYWRIGHT,
    });
  });

  it("keeps a merge file when any remaining tool owns it, not only when all do", async () => {
    const target = project({ [MCP]: JSON.stringify({ hub: HUB, playwright: PLAYWRIGHT }) });
    target.manifest.addTool(TOOL.claude, "test", [], [merging(MCP, { hub: HUB })]);
    target.manifest.addTool(TOOL.codex, "test", [], [merging(MCP, { playwright: PLAYWRIGHT })]);
    target.manifest.addTool(TOOL.copilot, "test", [], [merging("copilot.json", {})]);

    await remove(target, [TOOL.claude]);

    expect(JSON.parse(target.fs.getFile(join(PROJECT_ROOT, MCP)) ?? "")).toStrictEqual({
      playwright: PLAYWRIGHT,
    });
  });

  it("does not count a merge file already gone from disk", async () => {
    const target = project({});
    target.manifest.addTool(TOOL.claude, "test", [], [merging(MCP, { hub: HUB })]);

    const results = await remove(target, [TOOL.claude]);

    expect(results).toStrictEqual([{ toolId: TOOL.claude, fileCount: 0, deletedFiles: [] }]);
  });

  it("leaves an IDE merge file byte-identical when it tracks no key in it", async () => {
    const target = project({ ".vscode/settings.json": '{"a":1}' });
    target.manifest.addTool(TOOL.vscode, "test", [], [merging(".vscode/settings.json", {})]);

    const results = await remove(target, [TOOL.vscode]);

    expect(results).toStrictEqual([{ toolId: TOOL.vscode, fileCount: 0, deletedFiles: [] }]);
    expect(target.fs.getFile(join(PROJECT_ROOT, ".vscode/settings.json"))).toBe('{"a":1}');
  });

  it("strips an IDE tool's keys and deletes the file once nothing is left", async () => {
    const target = project({ ".vscode/extensions.json": '{"recommendations":["a"]}' });
    target.manifest.addTool(
      TOOL.vscode,
      "test",
      [],
      [merging(".vscode/extensions.json", { recommendations: ["a"] })]
    );

    const results = await remove(target, [TOOL.vscode]);

    expect(results).toStrictEqual([
      { toolId: TOOL.vscode, fileCount: 1, deletedFiles: [".vscode/extensions.json"] },
    ]);
    expect(target.fs.has(join(PROJECT_ROOT, ".vscode/extensions.json"))).toBe(false);
  });

  it("strips an IDE tool's keys and keeps the user's own", async () => {
    const target = project({ ".vscode/settings.json": '{"editor.tabSize":2,"user.key":7}' });
    target.manifest.addTool(
      TOOL.vscode,
      "test",
      [],
      [merging(".vscode/settings.json", { "editor.tabSize": 2 })]
    );

    const results = await remove(target, [TOOL.vscode]);

    expect(results).toStrictEqual([{ toolId: TOOL.vscode, fileCount: 0, deletedFiles: [] }]);
    expect(
      JSON.parse(target.fs.getFile(join(PROJECT_ROOT, ".vscode/settings.json")) ?? "")
    ).toStrictEqual({ "user.key": 7 });
  });
});

describe("UninstallTools — a project's tools", () => {
  it.each([TOOL.cursor, TOOL.codex] as const)(
    "detaches only the selected %s tool's shared claims after local removal",
    async (selected) => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      for (const toolId of [TOOL.cursor, TOOL.codex]) await installTool(deps, PROJECT_ROOT, toolId);
      const project = deps.manifestRepo.getCurrent();
      if (project === null) throw new Error("fixture missing project");
      const record = (name: string, scope: "user" | "project") =>
        InstalledPlugin.fromMetadata(
          name,
          "1.0.0",
          { kind: "local", path: "/shared" },
          false,
          scope
        );
      project.addPlugin(TOOL.cursor, record("shared", "user"));
      project.addPlugin(TOOL.cursor, record("local-only", "project"));
      const registration = {
        binary: "codex",
        marketplaces: [{ alias: "aidd", hostName: "aidd" }],
        pluginRefs: ["native@aidd"],
      };
      project.setNativeRegistrations(TOOL.codex, registration);
      const machine = Manifest.create();
      machine.addTool(TOOL.cursor, "1.0.0", []);
      for (const name of ["shared", "local-only"])
        machine.addPlugin(TOOL.cursor, record(name, "user").withDependents([PROJECT_ROOT, "/B"]));
      machine.addTool(TOOL.codex, "1.0.0", []);
      machine.setNativeRegistrations(TOOL.codex, {
        ...registration,
        pluginClaims: [{ ref: "native@aidd", dependents: [PROJECT_ROOT, "/B"] }],
      });
      await deps.userManifestRepo.save(machine);
      const retainedTool = selected === TOOL.cursor ? TOOL.codex : TOOL.cursor;

      await uninstaller(
        deps.fs,
        deps.manifestRepo,
        deps.logger,
        detachProjectClaims(deps.userManifestRepo, deps.fs)
      ).execute({
        tools: catalogOf(),
        toolIds: [selected],
        projectRoot: PROJECT_ROOT,
      });

      expect(deps.manifestRepo.getCurrent()?.hasTool(selected)).toBe(false);
      expect(deps.manifestRepo.getCurrent()?.hasTool(retainedTool)).toBe(true);
      expect(
        deps.userManifestRepo
          .getCurrent()
          ?.getPlugins(TOOL.cursor)
          .map((plugin) => ({
            name: plugin.name,
            dependents: plugin.dependents,
          }))
      ).toEqual([
        { name: "shared", dependents: selected === "cursor" ? ["/B"] : [PROJECT_ROOT, "/B"] },
        { name: "local-only", dependents: [PROJECT_ROOT, "/B"] },
      ]);
      expect(
        deps.userManifestRepo.getCurrent()?.getNativeRegistrations(TOOL.codex)?.pluginClaims
      ).toEqual([
        { ref: "native@aidd", dependents: selected === "codex" ? ["/B"] : [PROJECT_ROOT, "/B"] },
      ]);
    }
  );

  it("no longer tracks removed tool files", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.claude);

    const useCase = uninstaller(deps.fs, deps.manifestRepo, deps.logger);
    await useCase.execute({
      tools: catalogOf(),
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
    });

    const manifest = await deps.manifestRepo.load();
    expect(manifest?.getInstalledToolIds()).not.toContain("claude");
  });

  it("completes without error when files were already deleted from disk", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.claude);

    const claudeFiles = deps.fs.listUnder(join(PROJECT_ROOT, ".claude"));
    for (const f of claudeFiles) {
      await deps.fs.deleteFile(f);
    }

    const useCase = uninstaller(deps.fs, deps.manifestRepo, deps.logger);
    await expect(
      useCase.execute({
        tools: catalogOf(),
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
      })
    ).resolves.not.toThrow();
  });

  it("does not delete shared files when one of two tools sharing them is uninstalled", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.claude);
    await installTool(deps, PROJECT_ROOT, TOOL.vscode);

    const sharedFile = join(PROJECT_ROOT, ".vscode", "settings.json");
    expect(deps.fs.has(sharedFile)).toBe(true);

    const useCase = uninstaller(deps.fs, deps.manifestRepo, deps.logger);
    await useCase.execute({
      tools: catalogOf(),
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(deps.fs.has(sharedFile)).toBe(true);
  });

  describe("user-prime merge files", () => {
    it("deletes settings.json when empty after stripping all AIDD-managed keys", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.vscode);

      const settingsPath = join(PROJECT_ROOT, ".vscode", "settings.json");
      expect(deps.fs.has(settingsPath)).toBe(true);

      const useCase = uninstaller(deps.fs, deps.manifestRepo, deps.logger);
      await useCase.execute({
        tools: catalogOf(),
        toolIds: [TOOL.vscode],
        projectRoot: PROJECT_ROOT,
      });

      expect(deps.fs.has(settingsPath)).toBe(false);
    });

    it("deletes keybindings.json on uninstall — whole-file ownership, no zombie", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.vscode);

      const keybindingsPath = join(PROJECT_ROOT, ".vscode", "keybindings.json");
      expect(deps.fs.has(keybindingsPath)).toBe(true);

      const useCase = uninstaller(deps.fs, deps.manifestRepo, deps.logger);
      await useCase.execute({
        tools: catalogOf(),
        toolIds: [TOOL.vscode],
        projectRoot: PROJECT_ROOT,
      });

      expect(deps.fs.has(keybindingsPath)).toBe(false);
    });
  });
});

describe("UninstallTools — refusals", () => {
  it("refuses to remove nothing, naming every tool it knows", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);

    await expect(
      uninstaller(deps.fs, deps.manifestRepo, deps.logger).execute({
        tools: catalogOf(),
        toolIds: [],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(
      new InputRequiredError(
        "At least one tool ID is required. Valid tools: claude, cursor, copilot, opencode, kilo, codex, antigravity, vscode"
      )
    );
  });

  it("refuses a project that has no manifest", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);

    await expect(
      uninstaller(deps.fs, deps.manifestRepo, deps.logger).execute({
        tools: catalogOf(),
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(NoManifestError);
  });

  it("refuses a tool that is not installed", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);

    await expect(
      uninstaller(deps.fs, deps.manifestRepo, deps.logger).execute({
        tools: catalogOf(),
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(ToolNotInstalledError);
  });
});

function parse(raw: string | undefined): Record<string, unknown> {
  return JSON.parse(raw ?? "{}") as Record<string, unknown>;
}

describe("UninstallTools, IDE — merge-file entries", () => {
  it("removes the keys it merged into a shared settings file", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.vscode);

    const managedKeys = Object.keys(parse(deps.fs.getFile(SETTINGS_FILE)));
    expect(managedKeys.length).toBeGreaterThan(0);

    await uninstaller(deps.fs, deps.manifestRepo, deps.logger).execute({
      tools: catalogOf(),
      toolIds: [TOOL.vscode],
      projectRoot: PROJECT_ROOT,
    });

    const after = parse(deps.fs.getFile(SETTINGS_FILE));
    for (const key of managedKeys) {
      expect(Object.keys(after)).not.toContain(key);
    }
  });

  it("leaves a user-authored key in that shared file untouched", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.vscode);

    const withUserKey = { ...parse(deps.fs.getFile(SETTINGS_FILE)), "editor.tabSize": 7 };
    await deps.fs.writeFile(SETTINGS_FILE, JSON.stringify(withUserKey, null, 2));

    await uninstaller(deps.fs, deps.manifestRepo, deps.logger).execute({
      tools: catalogOf(),
      toolIds: [TOOL.vscode],
      projectRoot: PROJECT_ROOT,
    });

    expect(parse(deps.fs.getFile(SETTINGS_FILE))["editor.tabSize"]).toBe(7);
  });

  it("removes its merged keys from every declared merge file, not just settings.json", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.vscode);

    const before = Object.keys(parse(deps.fs.getFile(EXTENSIONS)));
    expect(before.length).toBeGreaterThan(0);

    await uninstaller(deps.fs, deps.manifestRepo, deps.logger).execute({
      tools: catalogOf(),
      toolIds: [TOOL.vscode],
      projectRoot: PROJECT_ROOT,
    });

    const after = parse(deps.fs.getFile(EXTENSIONS));
    for (const key of before) {
      expect(Object.keys(after)).not.toContain(key);
    }
  });

  it("drops the tool from the manifest", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.vscode);

    await uninstaller(deps.fs, deps.manifestRepo, deps.logger).execute({
      tools: catalogOf(),
      toolIds: [TOOL.vscode],
      projectRoot: PROJECT_ROOT,
    });

    const manifest = await deps.manifestRepo.load();
    expect(manifest?.hasTool(TOOL.vscode)).toBe(false);
  });
});

describe("UninstallTools, IDE — refusals and report", () => {
  it("refuses a project that has no manifest", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);

    await expect(
      uninstaller(deps.fs, deps.manifestRepo, deps.logger).execute({
        tools: catalogOf(),
        toolIds: [TOOL.vscode],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(NoManifestError);
  });

  it("refuses a tool that is not installed", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);

    await expect(
      uninstaller(deps.fs, deps.manifestRepo, deps.logger).execute({
        tools: catalogOf(),
        toolIds: [TOOL.vscode],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(ToolNotInstalledError);
  });

  it("reports every file it removed", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.vscode);

    const result = await uninstaller(deps.fs, deps.manifestRepo, deps.logger).execute({
      tools: catalogOf(),
      toolIds: [TOOL.vscode],
      projectRoot: PROJECT_ROOT,
    });

    expect(result).toStrictEqual([
      {
        toolId: TOOL.vscode,
        fileCount: 3,
        deletedFiles: [
          ".vscode/keybindings.json",
          ".vscode/extensions.json",
          ".vscode/settings.json",
        ],
      },
    ]);
  });
});
