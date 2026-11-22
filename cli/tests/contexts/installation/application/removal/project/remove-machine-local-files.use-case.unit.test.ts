import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { projectIntegrationOf } from "../../../../../../src/composition/installation.js";
import { RemoveMachineLocalFiles } from "../../../../../../src/contexts/installation/application/removal/project/remove-machine-local-files.use-case.js";
import { RecordedPlugin } from "../../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../../../src/shared/domain/file-hash.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../../../shared/testing/saying.builder.js";
import { cursorHookScriptDir } from "../../../testing/cursor-hook-scripts.builder.js";
import { aManifest } from "../../../testing/manifest.builder.js";

const ROOT = "/test-project";

function localPlugin(name: string): RecordedPlugin {
  return RecordedPlugin.fromMetadata({
    name,
    version: "1.0.0",
    source: { kind: "local", path: "/p" },
    strict: false,
    scope: "project",
  });
}

describe("removing the machine-local files of a project", () => {
  it("deletes the machine-local settings file a tool writes and counts it", async () => {
    const tools = registeredTools();
    const [settings] = tools.profile(TOOL.claude).machineLocalFiles();
    const manifest = aManifest().withTool(TOOL.claude, []).build();
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, settings ?? ""), "{}");

    const count = await new RemoveMachineLocalFiles(
      fs,
      tools,
      projectIntegrationOf(fs).removeHooks
    ).execute(manifest, ROOT, {
      overwriteEdited: false,
    });

    expect(fs.has(join(ROOT, settings ?? ""))).toBe(false);
    expect(count).toBe(1);
  });

  describe("over a hook script edited after install", () => {
    const script = `${cursorHookScriptDir("aidd-context")}run.js`;
    const manifest = aManifest()
      .withTool(TOOL.cursor, [])
      .withPlugin(
        TOOL.cursor,
        localPlugin("aidd-context").withProjectHooks({
          entries: [],
          scripts: new Map([[script, FileHash.of("// installed").value]]),
        })
      )
      .build();

    function editedScript(): InMemoryFileAdapter {
      const fs = new InMemoryFileAdapter();
      fs.setFile(join(ROOT, script), "// edited");
      return fs;
    }

    it("removes it when forced", async () => {
      const fs = editedScript();

      await new RemoveMachineLocalFiles(
        fs,
        registeredTools(),
        projectIntegrationOf(fs).removeHooks
      ).execute(manifest, ROOT, {
        overwriteEdited: true,
      });

      expect(fs.has(join(ROOT, script))).toBe(false);
    });

    it("refuses to remove it unless forced", async () => {
      const fs = editedScript();

      await expect(
        new RemoveMachineLocalFiles(
          fs,
          registeredTools(),
          projectIntegrationOf(fs).removeHooks
        ).execute(manifest, ROOT, {
          overwriteEdited: false,
        })
      ).rejects.toThrow(saying("edited after install"));
    });
  });

  it("asks no AI profile of a tool that is not an AI tool", async () => {
    const manifest = aManifest()
      .withTool(TOOL.vscode, [])
      .withPlugin(TOOL.vscode, localPlugin("ide-plugin"))
      .build();

    const fs = new InMemoryFileAdapter();
    await expect(
      new RemoveMachineLocalFiles(
        fs,
        registeredTools(),
        projectIntegrationOf(fs).removeHooks
      ).execute(manifest, ROOT, { overwriteEdited: false })
    ).resolves.toBe(0);
  });
});
