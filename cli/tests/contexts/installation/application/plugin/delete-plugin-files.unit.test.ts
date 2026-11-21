import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deletePluginFilesForTool } from "../../../../../src/contexts/installation/application/plugin/delete-plugin-files.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = "/test-project";

describe("deletePluginFilesForTool()", () => {
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
      },
      fs
    );

    expect(deleted).toStrictEqual(["a/first.md", "b/second.md"]);
    expect(fs.listAll()).toStrictEqual([]);
  });
});
