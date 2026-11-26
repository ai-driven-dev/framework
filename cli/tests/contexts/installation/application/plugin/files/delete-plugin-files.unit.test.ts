import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deletePluginFilesForTool } from "../../../../../../src/contexts/installation/application/plugin/files/delete-plugin-files.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = "/test-project";

describe("deleting a tool's plugin files", () => {
  it("returns exactly the tracked paths it deleted, in manifest order", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(PROJECT_ROOT, "a/first.md"), "1");
    fs.setFile(join(PROJECT_ROOT, "b/second.md"), "2");
    const files = new Map([
      ["a/first.md", "h1"],
      ["b/second.md", "h2"],
    ]);

    const deleted = await deletePluginFilesForTool(
      {
        files,
        scope: "project",
        tool: registeredTools().aiProfile(TOOL.claude),
        projectRoot: PROJECT_ROOT,
        homedir: () => "/home/dev",
      },
      fs
    );

    expect(deleted).toStrictEqual(["a/first.md", "b/second.md"]);
    expect(fs.listAll()).toStrictEqual([]);
  });

  describe("the directories a removal leaves empty", () => {
    const remove = (fs: InMemoryFileAdapter, files: string[]) =>
      deletePluginFilesForTool(
        {
          files: new Map(files.map((file) => [file, "h"])),
          scope: "project",
          tool: registeredTools().aiProfile(TOOL.claude),
          projectRoot: PROJECT_ROOT,
          homedir: () => "/home/dev",
        },
        fs
      );

    it("removes the plugin subfolder it empties", async () => {
      const fs = new InMemoryFileAdapter();
      fs.setFile(join(PROJECT_ROOT, ".claude/agents/plugin/a.md"), "1");
      fs.setFile(join(PROJECT_ROOT, ".claude/settings.json"), "{}");

      await remove(fs, [".claude/agents/plugin/a.md"]);

      expect(await fs.isDirectory(join(PROJECT_ROOT, ".claude/agents/plugin"))).toBe(false);
    });

    it("keeps the tool root and the project root once everything under them is gone", async () => {
      const fs = new InMemoryFileAdapter();
      fs.setFile(join(PROJECT_ROOT, ".claude/agents/a.md"), "1");

      await remove(fs, [".claude/agents/a.md"]);

      expect(await fs.isDirectory(join(PROJECT_ROOT, ".claude"))).toBe(true);
      expect(await fs.isDirectory(PROJECT_ROOT)).toBe(true);
    });

    it("keeps a folder that still holds a file of the user", async () => {
      const fs = new InMemoryFileAdapter();
      fs.setFile(join(PROJECT_ROOT, ".claude/agents/a.md"), "1");
      fs.setFile(join(PROJECT_ROOT, ".claude/agents/mine.md"), "2");

      await remove(fs, [".claude/agents/a.md"]);

      expect(fs.has(join(PROJECT_ROOT, ".claude/agents/mine.md"))).toBe(true);
    });

    it("removes the plugin folder of a user-scope removal and keeps the user directory", async () => {
      const fs = new InMemoryFileAdapter();
      const userDir =
        registeredTools().aiProfile(TOOL.cursor).plugins()?.userPluginsBaseDir("/home/dev") ?? "";
      fs.setFile(join(userDir, "plugin/a.md"), "1");

      await deletePluginFilesForTool(
        {
          files: new Map([["plugin/a.md", "h"]]),
          scope: "user",
          ownerScope: "user",
          tool: registeredTools().aiProfile(TOOL.cursor),
          projectRoot: PROJECT_ROOT,
          homedir: () => "/home/dev",
        },
        fs
      );

      expect(await fs.isDirectory(join(userDir, "plugin"))).toBe(false);
      expect(await fs.isDirectory(userDir)).toBe(true);
    });
  });
});
