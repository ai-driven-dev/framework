import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RemoveToolFiles } from "../../../../../src/contexts/installation/application/removal/remove-tool-files.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { InstallationFile } from "../../../../../src/shared/domain/file.js";
import type { MergeFileEntry } from "../../../../../src/shared/domain/merge.js";
import type { ToolId } from "../../../../../src/shared/domain/tool.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { catalogOf, TOOL } from "../../../tools/testing/catalog-of.js";

const ROOT = "/test-project";
const AGENTS = "AGENTS.md";
const SETTINGS = ".claude/settings.json";
const MCP = ".mcp.json";
const hasher = new DeterministicHasher();

function tracked(relativePath: string, content: string): InstallationFile {
  return new InstallationFile({ relativePath, content: "", hash: hasher.hash(content) });
}

function merging(relativePath: string, values: Record<string, unknown>): MergeFileEntry {
  const entries = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, hasher.hash(JSON.stringify(value))])
  );
  return { relativePath, sectionKey: null, entries };
}

function projectWith(seed: Record<string, string>) {
  const absolute = Object.fromEntries(
    Object.entries(seed).map(([relativePath, content]) => [join(ROOT, relativePath), content])
  );
  return { fs: new InMemoryFileAdapter(absolute, hasher), manifest: Manifest.create() };
}

function removal(
  target: { fs: InMemoryFileAdapter; manifest: Manifest },
  toolId: ToolId,
  allToolIds: ToolId[],
  logger = new CapturingLogger()
): Promise<string[]> {
  return new RemoveToolFiles(target.fs, logger).remove(
    toolId,
    allToolIds,
    catalogOf(),
    target.manifest,
    ROOT
  );
}

describe("RemoveToolFiles.remove", () => {
  it("announces the tool it removes", async () => {
    const target = projectWith({});
    target.manifest.addTool(TOOL.claude, "test", []);
    const logger = new CapturingLogger();

    await removal(target, TOOL.claude, [TOOL.claude], logger);

    expect(logger.infoMessages).toStrictEqual(["Removing claude files..."]);
  });

  it("keeps a file another installed tool still tracks", async () => {
    const target = projectWith({ [SETTINGS]: "{}", [AGENTS]: "# Agents" });
    target.manifest.addTool(TOOL.claude, "test", [
      tracked(SETTINGS, "{}"),
      tracked(AGENTS, "# Agents"),
    ]);
    target.manifest.addTool(TOOL.codex, "test", [tracked(AGENTS, "# Agents")]);

    const deleted = await removal(target, TOOL.claude, [TOOL.claude]);

    expect(deleted).toStrictEqual([SETTINGS]);
    expect(target.fs.has(join(ROOT, AGENTS))).toBe(true);
  });

  it("deletes a file shared only between the tools removed together", async () => {
    const target = projectWith({ [AGENTS]: "# Agents" });
    target.manifest.addTool(TOOL.claude, "test", [tracked(AGENTS, "# Agents")]);
    target.manifest.addTool(TOOL.codex, "test", [tracked(AGENTS, "# Agents")]);

    const deleted = await removal(target, TOOL.claude, [TOOL.claude, TOOL.codex]);

    expect(deleted).toStrictEqual([AGENTS]);
    expect(target.fs.has(join(ROOT, AGENTS))).toBe(false);
  });

  it("keeps a file another installed tool merges into", async () => {
    const target = projectWith({ [MCP]: '{"hub":{}}' });
    target.manifest.addTool(TOOL.claude, "test", [tracked(MCP, '{"hub":{}}')]);
    target.manifest.addTool(TOOL.codex, "test", [], [merging(MCP, { hub: {} })]);

    const deleted = await removal(target, TOOL.claude, [TOOL.claude]);

    expect(deleted).toStrictEqual([]);
    expect(target.fs.has(join(ROOT, MCP))).toBe(true);
  });

  it("deletes the project-scope plugin files of the tool, leaves another tool's plugins, and lists none as deleted", async () => {
    const first = ".claude/plugins/project-plugin/skills/demo/SKILL.md";
    const second = ".claude/plugins/project-plugin/commands/demo.md";
    const neighbor = ".codex/plugins/other-plugin/skills/demo/SKILL.md";
    const target = projectWith({
      [first]: "skill",
      [second]: "command",
      [neighbor]: "other plugin",
    });
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

    const deleted = await removal(target, TOOL.claude, [TOOL.claude]);

    expect(target.fs.has(join(ROOT, first))).toBe(false);
    expect(target.fs.has(join(ROOT, second))).toBe(false);
    expect(target.fs.getFile(join(ROOT, neighbor))).toBe("other plugin");
    expect(deleted).toStrictEqual([]);
  });

  it("leaves a machine-owned user-scope plugin in place while removing a project tool", async () => {
    const key = "aidd-context/commands/hello.md";
    const userFile = join(homedir(), ".cursor", "plugins", "local", key);
    const target = projectWith({ [key]: "project copy" });
    target.fs.setFile(userFile, "user copy");
    target.manifest.addTool(TOOL.cursor, "test", []);
    target.manifest.addPlugin(
      TOOL.cursor,
      InstalledPlugin.fromJSON({
        name: "aidd-context",
        source: { kind: "local", path: "/some/path" },
        version: "1.0.0",
        strict: false,
        scope: "user",
        files: { [key]: hasher.hash("user copy").value },
      })
    );

    await removal(target, TOOL.cursor, [TOOL.cursor]);

    expect(target.fs.has(userFile)).toBe(true);
    expect(target.fs.has(join(ROOT, key))).toBe(true);
  });
});
