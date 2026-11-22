import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RemoveProjectFiles } from "../../../../../../src/contexts/installation/application/removal/project/remove-project-files.js";
import { UpdateGitignore } from "../../../../../../src/contexts/installation/application/update-gitignore.use-case.js";
import type { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../../../src/shared/domain/file-hash.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../../../shared/testing/saying.builder.js";
import { cursorHookScriptDir } from "../../../testing/cursor-hook-scripts.builder.js";
import { aManifest } from "../../../testing/manifest.builder.js";
import { removeProjectFilesOver } from "../../../testing/remove-project-files.builder.js";

const ROOT = "/test-project";

function removalOver(
  manifest: Manifest | null,
  fs: InMemoryFileAdapter,
  repo = new InMemoryManifestRepository(manifest, ROOT),
  gitignore = new UpdateGitignore(fs)
): RemoveProjectFiles {
  return removeProjectFilesOver({
    fs,
    manifestRepo: repo,
    logger: new CapturingLogger(),
    updateGitignore: gitignore,
    homedir: () => "/home/dev",
    tools: registeredTools(),
  });
}

describe("removing a project's files", () => {
  it("removes nothing from a project that installed nothing", async () => {
    await expect(removalOver(null, new InMemoryFileAdapter()).remove(ROOT, true)).resolves.toBe(0);
  });

  it("counts the machine-local files it removes with the tracked ones", async () => {
    const [settings] = registeredTools().profile(TOOL.claude).machineLocalFiles();
    const manifest = aManifest().withTool(TOOL.claude, []).build();
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, settings ?? ""), "{}");

    await expect(removalOver(manifest, fs).remove(ROOT, true)).resolves.toBe(1);
  });

  describe("over a hook script edited after install", () => {
    const script = `${cursorHookScriptDir("aidd-context")}run.js`;
    const manifest = aManifest()
      .withTool(TOOL.cursor, [])
      .withPlugin(
        TOOL.cursor,
        RecordedPlugin.fromMetadata({
          name: "aidd-context",
          version: "1.0.0",
          source: { kind: "local", path: "/p" },
          strict: false,
          scope: "project",
        }).withProjectHooks({
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

      await removalOver(manifest, fs).remove(ROOT, true);

      expect(fs.has(join(ROOT, script))).toBe(false);
    });

    it("refuses to remove it unless forced", async () => {
      await expect(removalOver(manifest, editedScript()).remove(ROOT, false)).rejects.toThrow(
        saying("edited after install")
      );
    });
  });

  it("takes AIDD's own traces back out of the gitignore", async () => {
    const manifest = aManifest().withTool(TOOL.claude, []).build();
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, ".gitignore"), "node_modules\n.aidd/cache/\n");

    await removalOver(manifest, fs).remove(ROOT, true);

    expect(await fs.readFile(join(ROOT, ".gitignore"))).toBe("node_modules\n");
  });
});
