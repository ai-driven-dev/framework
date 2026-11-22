import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../../src/composition/installation.js";
import { RemoveToolFiles } from "../../../../src/contexts/installation/application/removal/project/remove-tool-files.use-case.js";
import {
  type DetachProjectClaims,
  UninstallTools,
  type UninstallToolsRequest,
} from "../../../../src/contexts/installation/application/uninstall-tools.use-case.js";
import {
  ManifestUnavailableError,
  ToolNotInstalledError,
} from "../../../../src/contexts/installation/domain/installation.error.js";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { detachProjectClaims } from "../../../../src/contexts/machine-claims/application/removal/detach-project-claims.js";
import { FileHash } from "../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../src/shared/domain/installation-file.js";
import type { MergeFileEntry } from "../../../../src/shared/domain/merge.js";
import type { Scope } from "../../../../src/shared/domain/scope.js";
import { InputRequiredError } from "../../../../src/shared/domain/shared.error.js";
import type { ToolId } from "../../../../src/shared/domain/tool.js";
import type { FileReader } from "../../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../../src/shared/ports/file-writer.js";
import type { Logger } from "../../../../src/shared/ports/logger.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../shared/testing/in-memory-manifest-repository.fake.js";
import {
  buildInstallationDeps,
  initProject,
  installTool,
} from "../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = "/test-project";
const SETTINGS_FILE = join(PROJECT_ROOT, ".vscode/settings.json");

const noClaims: DetachProjectClaims = async () => undefined;

function uninstaller(
  fs: FileReader & FileWriter,
  manifestRepo: InMemoryManifestRepository,
  logger: Logger = new CapturingLogger(),
  detachClaims: DetachProjectClaims = noClaims
) {
  const uninstall = new UninstallTools(
    {
      manifestRepo,
      detachClaims,
      removeToolFiles: new RemoveToolFiles(fs, logger, registeredTools(), () => "/home/dev"),
    },
    registeredTools()
  );
  return {
    execute: (command: Omit<UninstallToolsRequest, "records">) =>
      uninstall.execute({ ...command, records: registrationRecordRules }),
  };
}

const SETTINGS = ".claude/settings.json";
const AGENTS = "AGENTS.md";
const MCP = ".mcp.json";

function tracked(relativePath: string, content: string): InstallationFile {
  return new InstallationFile({ relativePath, content: "", hash: FileHash.of(content) });
}

function merging(
  relativePath: string,
  values: Record<string, unknown>,
  sectionKey: string | null = null
): MergeFileEntry {
  const entries: Record<string, FileHash> = {};
  for (const [key, value] of Object.entries(values)) {
    entries[key] = FileHash.of(JSON.stringify(value));
  }
  return { relativePath, sectionKey, entries };
}

function project(seed: Record<string, string>): { fs: InMemoryFileAdapter; manifest: Manifest } {
  const absolute: Record<string, string> = {};
  for (const [relativePath, content] of Object.entries(seed)) {
    absolute[join(PROJECT_ROOT, relativePath)] = content;
  }
  return { fs: new InMemoryFileAdapter(absolute), manifest: Manifest.create() };
}

function remove(
  target: { fs: InMemoryFileAdapter; manifest: Manifest },
  toolIds: ToolId[],
  logger = new CapturingLogger()
) {
  return uninstaller(target.fs, new InMemoryManifestRepository(target.manifest), logger).execute({
    toolIds,
    projectRoot: PROJECT_ROOT,
  });
}

describe("UninstallTools - regular files", () => {
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
});

describe("UninstallTools - merge files", () => {
  const HUB = { command: "hub" };
  const PLAYWRIGHT = { command: "npx" };

  it("deletes a merge file an AI tool alone owns, even one it cannot parse", async () => {
    const target = project({ [MCP]: "not json" });
    target.manifest.addTool(TOOL.claude, "test", []);
    target.manifest.updateToolMergeFiles(TOOL.claude, [merging(MCP, { hub: HUB })]);

    const results = await remove(target, [TOOL.claude]);

    expect(results).toStrictEqual([{ toolId: TOOL.claude, fileCount: 1, deletedFiles: [MCP] }]);
    expect(target.fs.has(join(PROJECT_ROOT, MCP))).toBe(false);
  });

  it("deletes a section-scoped merge file an AI tool alone owns even when it tracks no key in it", async () => {
    const target = project({ [MCP]: '{"x":1}', "codex.json": "{}" });
    target.manifest.addTool(TOOL.claude, "test", []);
    target.manifest.updateToolMergeFiles(TOOL.claude, [merging(MCP, {}, "mcpServers")]);
    target.manifest.addTool(TOOL.codex, "test", []);
    target.manifest.updateToolMergeFiles(TOOL.codex, [merging("codex.json", {})]);

    const results = await remove(target, [TOOL.claude]);

    expect(results).toStrictEqual([{ toolId: TOOL.claude, fileCount: 1, deletedFiles: [MCP] }]);
    expect(target.fs.has(join(PROJECT_ROOT, MCP))).toBe(false);
  });

  it("strips its own keys from a merge file a remaining tool owns and does not count it", async () => {
    const target = project({ [MCP]: JSON.stringify({ hub: HUB, playwright: PLAYWRIGHT }) });
    target.manifest.addTool(TOOL.claude, "test", []);
    target.manifest.updateToolMergeFiles(TOOL.claude, [merging(MCP, { hub: HUB })]);
    target.manifest.addTool(TOOL.codex, "test", []);
    target.manifest.updateToolMergeFiles(TOOL.codex, [
      merging("codex.json", {}),
      merging(MCP, { playwright: PLAYWRIGHT }),
    ]);

    const results = await remove(target, [TOOL.claude]);

    expect(results).toStrictEqual([{ toolId: TOOL.claude, fileCount: 0, deletedFiles: [] }]);
    expect(JSON.parse(target.fs.getFile(join(PROJECT_ROOT, MCP)) ?? "")).toStrictEqual({
      playwright: PLAYWRIGHT,
    });
  });

  it("keeps a merge file when any remaining tool owns it, not only when all do", async () => {
    const target = project({ [MCP]: JSON.stringify({ hub: HUB, playwright: PLAYWRIGHT }) });
    target.manifest.addTool(TOOL.claude, "test", []);
    target.manifest.updateToolMergeFiles(TOOL.claude, [merging(MCP, { hub: HUB })]);
    target.manifest.addTool(TOOL.codex, "test", []);
    target.manifest.updateToolMergeFiles(TOOL.codex, [merging(MCP, { playwright: PLAYWRIGHT })]);
    target.manifest.addTool(TOOL.copilot, "test", []);
    target.manifest.updateToolMergeFiles(TOOL.copilot, [merging("copilot.json", {})]);

    await remove(target, [TOOL.claude]);

    expect(JSON.parse(target.fs.getFile(join(PROJECT_ROOT, MCP)) ?? "")).toStrictEqual({
      playwright: PLAYWRIGHT,
    });
  });

  it("does not count a merge file already gone from disk", async () => {
    const target = project({});
    target.manifest.addTool(TOOL.claude, "test", []);
    target.manifest.updateToolMergeFiles(TOOL.claude, [merging(MCP, { hub: HUB })]);

    const results = await remove(target, [TOOL.claude]);

    expect(results).toStrictEqual([{ toolId: TOOL.claude, fileCount: 0, deletedFiles: [] }]);
  });

  it("leaves an IDE merge file byte-identical when it tracks no key in it", async () => {
    const target = project({ ".vscode/settings.json": '{"a":1}' });
    target.manifest.addTool(TOOL.vscode, "test", []);
    target.manifest.updateToolMergeFiles(TOOL.vscode, [merging(".vscode/settings.json", {})]);

    const results = await remove(target, [TOOL.vscode]);

    expect(results).toStrictEqual([{ toolId: TOOL.vscode, fileCount: 0, deletedFiles: [] }]);
    expect(target.fs.getFile(join(PROJECT_ROOT, ".vscode/settings.json"))).toBe('{"a":1}');
  });

  it("strips an IDE tool's keys and deletes the file once nothing is left", async () => {
    const target = project({ ".vscode/extensions.json": '{"recommendations":["a"]}' });
    target.manifest.addTool(TOOL.vscode, "test", []);
    target.manifest.updateToolMergeFiles(TOOL.vscode, [
      merging(".vscode/extensions.json", { recommendations: ["a"] }),
    ]);

    const results = await remove(target, [TOOL.vscode]);

    expect(results).toStrictEqual([
      { toolId: TOOL.vscode, fileCount: 1, deletedFiles: [".vscode/extensions.json"] },
    ]);
    expect(target.fs.has(join(PROJECT_ROOT, ".vscode/extensions.json"))).toBe(false);
  });

  it("strips an IDE tool's keys and keeps the user's own", async () => {
    const target = project({ ".vscode/settings.json": '{"editor.tabSize":2,"user.key":7}' });
    target.manifest.addTool(TOOL.vscode, "test", []);
    target.manifest.updateToolMergeFiles(TOOL.vscode, [
      merging(".vscode/settings.json", { "editor.tabSize": 2 }),
    ]);

    const results = await remove(target, [TOOL.vscode]);

    expect(results).toStrictEqual([{ toolId: TOOL.vscode, fileCount: 0, deletedFiles: [] }]);
    expect(
      JSON.parse(target.fs.getFile(join(PROJECT_ROOT, ".vscode/settings.json")) ?? "")
    ).toStrictEqual({ "user.key": 7 });
  });
});

async function seedSharedClaims(deps: Awaited<ReturnType<typeof buildInstallationDeps>>) {
  const project = deps.manifestRepo.getCurrent();
  if (project === null) throw new Error("fixture missing project");
  const record = (name: string, scope: Scope) =>
    RecordedPlugin.fromMetadata({
      name,
      version: "1.0.0",
      source: { kind: "local", path: "/shared" },
      strict: false,
      scope,
    });
  project.addPlugin(TOOL.cursor, record("shared", "user"));
  project.addPlugin(TOOL.cursor, record("local-only", "project"));
  const registration = {
    binary: "codex",
    marketplaces: [{ alias: "aidd", hostName: "aidd" }],
    pluginRefs: ["native@aidd"],
  };
  deps.manifestRepo.records.set(TOOL.codex, registration);
  const machine = Manifest.create();
  machine.addTool(TOOL.cursor, "1.0.0", []);
  for (const name of ["shared", "local-only"])
    machine.addPlugin(TOOL.cursor, record(name, "user").withMachineClaim([PROJECT_ROOT, "/B"]));
  machine.addTool(TOOL.codex, "1.0.0", []);
  deps.userManifestRepo.records.set(TOOL.codex, {
    ...registration,
    pluginClaims: [{ ref: "native@aidd", dependents: [PROJECT_ROOT, "/B"] }],
  });
  await deps.userManifestRepo.save(machine);
}

function userPluginDependents(deps: Awaited<ReturnType<typeof buildInstallationDeps>>) {
  const plugins = deps.userManifestRepo.getCurrent()?.getRecordedPlugins(TOOL.cursor) ?? [];
  return plugins.map((plugin) => ({ name: plugin.plugin.name, dependents: plugin.machineClaim }));
}

function codexClaims(deps: Awaited<ReturnType<typeof buildInstallationDeps>>) {
  return deps.userManifestRepo.records.get(TOOL.codex)?.pluginClaims;
}

describe("UninstallTools - a project's tools", () => {
  it.each([TOOL.cursor, TOOL.codex] as const)(
    "detaches only the selected %s tool's shared claims after local removal",
    async (selected) => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initProject(deps, PROJECT_ROOT);
      for (const toolId of [TOOL.cursor, TOOL.codex]) await installTool(deps, PROJECT_ROOT, toolId);
      await seedSharedClaims(deps);
      const retainedTool = selected === TOOL.cursor ? TOOL.codex : TOOL.cursor;

      await uninstaller(
        deps.fs,
        deps.manifestRepo,
        deps.logger,
        detachProjectClaims(deps.userManifestRepo, deps.fs)
      ).execute({
        toolIds: [selected],
        projectRoot: PROJECT_ROOT,
      });

      expect(deps.manifestRepo.getCurrent()?.hasTool(selected)).toBe(false);
      expect(deps.manifestRepo.getCurrent()?.hasTool(retainedTool)).toBe(true);
      expect(deps.manifestRepo.records.has(TOOL.codex)).toBe(selected !== TOOL.codex);
      expect(userPluginDependents(deps)).toEqual([
        { name: "shared", dependents: selected === "cursor" ? ["/B"] : [PROJECT_ROOT, "/B"] },
        { name: "local-only", dependents: [PROJECT_ROOT, "/B"] },
      ]);
      expect(codexClaims(deps)).toEqual([
        { ref: "native@aidd", dependents: selected === "codex" ? ["/B"] : [PROJECT_ROOT, "/B"] },
      ]);
    }
  );

  it("forgets the tool and still reports its tracked files when they were already deleted from disk", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.claude);

    const claudeFiles = deps.fs.listUnder(join(PROJECT_ROOT, ".claude"));
    for (const f of claudeFiles) {
      await deps.fs.deleteFile(f);
    }

    const result = await uninstaller(deps.fs, deps.manifestRepo, deps.logger).execute({
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(result).toStrictEqual([{ toolId: TOOL.claude, fileCount: 1, deletedFiles: [SETTINGS] }]);
    expect((await deps.manifestRepo.load())?.hasTool(TOOL.claude)).toBe(false);
  });

  describe("user-prime merge files", () => {
    it("deletes settings.json when empty after stripping all AIDD-managed keys", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.vscode);

      const settingsPath = join(PROJECT_ROOT, ".vscode", "settings.json");
      expect(deps.fs.has(settingsPath)).toBe(true);

      const useCase = uninstaller(deps.fs, deps.manifestRepo, deps.logger);
      await useCase.execute({
        toolIds: [TOOL.vscode],
        projectRoot: PROJECT_ROOT,
      });

      expect(deps.fs.has(settingsPath)).toBe(false);
    });

    it("deletes keybindings.json on uninstall - whole-file ownership, no zombie", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.vscode);

      const keybindingsPath = join(PROJECT_ROOT, ".vscode", "keybindings.json");
      expect(deps.fs.has(keybindingsPath)).toBe(true);

      const useCase = uninstaller(deps.fs, deps.manifestRepo, deps.logger);
      await useCase.execute({
        toolIds: [TOOL.vscode],
        projectRoot: PROJECT_ROOT,
      });

      expect(deps.fs.has(keybindingsPath)).toBe(false);
    });
  });
});

describe("UninstallTools - refusals", () => {
  it("refuses to remove nothing, naming every tool it knows", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initProject(deps, PROJECT_ROOT);

    await expect(
      uninstaller(deps.fs, deps.manifestRepo, deps.logger).execute({
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
    const deps = await buildInstallationDeps({ tools: registeredTools() });

    const failure = await uninstaller(deps.fs, deps.manifestRepo, deps.logger)
      .execute({ toolIds: [TOOL.claude], projectRoot: PROJECT_ROOT })
      .catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(ManifestUnavailableError);
    expect(failure).toMatchObject({ code: "manifest-missing" });
  });

  it("refuses a tool that is not installed", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initProject(deps, PROJECT_ROOT);

    await expect(
      uninstaller(deps.fs, deps.manifestRepo, deps.logger).execute({
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(ToolNotInstalledError);
  });
});

function parse(raw: string | undefined): Record<string, unknown> {
  return JSON.parse(raw ?? "{}") as Record<string, unknown>;
}

describe("UninstallTools, IDE - merge-file entries", () => {
  it("leaves a user-authored key in that shared file untouched", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.vscode);

    const withUserKey = { ...parse(deps.fs.getFile(SETTINGS_FILE)), "editor.tabSize": 7 };
    await deps.fs.writeFile(SETTINGS_FILE, JSON.stringify(withUserKey, null, 2));

    await uninstaller(deps.fs, deps.manifestRepo, deps.logger).execute({
      toolIds: [TOOL.vscode],
      projectRoot: PROJECT_ROOT,
    });

    expect(parse(deps.fs.getFile(SETTINGS_FILE))["editor.tabSize"]).toBe(7);
  });
});

describe("UninstallTools, IDE - report", () => {
  it("reports every file it removed", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.vscode);

    const result = await uninstaller(deps.fs, deps.manifestRepo, deps.logger).execute({
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
