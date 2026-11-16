import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deletePluginFilesForTool } from "../../../../../src/contexts/installation/application/plugin/plugin-helpers.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { registeredAiProfile, TOOL } from "../../../tools/testing/catalog-of.js";

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
      files,
      "project",
      registeredAiProfile(TOOL.claude),
      PROJECT_ROOT,
      fs
    );

    expect(deleted).toStrictEqual(["a/first.md", "b/second.md"]);
    expect(fs.listAll()).toStrictEqual([]);
  });
});
