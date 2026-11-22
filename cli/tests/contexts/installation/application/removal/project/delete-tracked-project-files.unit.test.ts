import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DeleteTrackedProjectFiles } from "../../../../../../src/contexts/installation/application/removal/project/delete-tracked-project-files.js";
import { RecordedPlugin } from "../../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../../../src/shared/domain/file-hash.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../../testing/manifest.builder.js";

const ROOT = "/test-project";

function deleterOver(fs: InMemoryFileAdapter): DeleteTrackedProjectFiles {
  return new DeleteTrackedProjectFiles(
    { fs, logger: new CapturingLogger(), homedir: () => "/home/dev" },
    registeredTools()
  );
}

function localPlugin(name: string): RecordedPlugin {
  return RecordedPlugin.fromMetadata({
    name,
    version: "1.0.0",
    source: { kind: "local", path: "/p" },
    strict: false,
    scope: "project",
  });
}

describe("deleting the tracked files of a project", () => {
  it("deletes a project-scope plugin's files from the project and counts them", async () => {
    const manifest = aManifest()
      .withTool(TOOL.claude, [])
      .withPlugin(
        TOOL.claude,
        localPlugin("aidd-context").withFiles(new Map([["skills/x.md", FileHash.of("x").value]]))
      )
      .build();
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, "skills", "x.md"), "x");

    const count = await deleterOver(fs).delete(manifest, ROOT);

    expect(fs.has(join(ROOT, "skills", "x.md"))).toBe(false);
    expect(count).toBe(1);
  });

  it("asks no AI profile of a tool that is not an AI tool", async () => {
    const manifest = aManifest()
      .withTool(TOOL.vscode, [])
      .withPlugin(TOOL.vscode, localPlugin("ide-plugin"))
      .build();

    await expect(deleterOver(new InMemoryFileAdapter()).delete(manifest, ROOT)).resolves.toBe(0);
  });
});
