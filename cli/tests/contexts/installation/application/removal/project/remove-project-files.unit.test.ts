import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RemoveProjectFiles } from "../../../../../../src/contexts/installation/application/removal/project/remove-project-files.js";
import { UpdateGitignore } from "../../../../../../src/contexts/installation/application/update-gitignore.use-case.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../../../src/shared/domain/file-hash.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { cursorHookScriptDir } from "../../../testing/cursor-hook-scripts.builder.js";
import { aManifest } from "../../../testing/manifest.builder.js";

const ROOT = "/test-project";

function removalOver(
  manifest: Manifest | null,
  fs: InMemoryFileAdapter,
  repo = new InMemoryManifestRepository(manifest, ROOT),
  gitignore = new UpdateGitignore(fs)
): RemoveProjectFiles {
  return new RemoveProjectFiles(
    {
      fs,
      manifestRepo: repo,
      logger: new CapturingLogger(),
      updateGitignore: gitignore,
      homedir: () => "/home/dev",
    },
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

describe("RemoveProjectFiles.remove", () => {
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

    const count = await removalOver(manifest, fs).remove(ROOT, true);

    expect(fs.has(join(ROOT, "skills", "x.md"))).toBe(false);
    expect(count).toBe(1);
  });

  it("removes nothing from a project that installed nothing", async () => {
    await expect(removalOver(null, new InMemoryFileAdapter()).remove(ROOT, true)).resolves.toBe(0);
  });

  it("asks no AI profile of a tool that is not an AI tool", async () => {
    const manifest = aManifest()
      .withTool(TOOL.vscode, [])
      .withPlugin(TOOL.vscode, localPlugin("ide-plugin"))
      .build();

    await expect(
      removalOver(manifest, new InMemoryFileAdapter()).remove(ROOT, false)
    ).resolves.toBe(0);
  });

  it("removes a hook script edited after install when forced", async () => {
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
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, script), "// edited");

    await removalOver(manifest, fs).remove(ROOT, true);

    expect(fs.has(join(ROOT, script))).toBe(false);
  });

  it("takes back every machine-local gitignore line the install added", async () => {
    const [machineLocal] = registeredTools().profile(TOOL.claude).machineLocalFiles();
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, ".gitignore"), `node_modules\n.aidd/cache/\n${machineLocal}\n`);

    await removalOver(manifest, fs).remove(ROOT, true);

    expect(await fs.readFile(join(ROOT, ".gitignore"))).toBe("node_modules\n");
  });

  it("has removed AIDD's own state by the time it takes the gitignore lines back", async () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    const fs = new InMemoryFileAdapter();
    const repo = new InMemoryManifestRepository(manifest, ROOT);
    const gitignore = new UpdateGitignore(fs);
    const manifestWhenGitignoreIsTouched: Array<Manifest | null> = [];
    gitignore.remove = async () => {
      manifestWhenGitignoreIsTouched.push(await repo.load());
    };

    await removalOver(manifest, fs, repo, gitignore).remove(ROOT, true);

    expect(manifestWhenGitignoreIsTouched).toEqual([null]);
  });
});
