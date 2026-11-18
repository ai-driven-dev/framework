import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RemoveProjectFiles } from "../../../../../src/contexts/installation/application/removal/remove-project-files.js";
import { UpdateGitignore } from "../../../../../src/contexts/installation/application/update-gitignore.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { pluginScriptDir } from "../../../../../src/contexts/tools/domain/hooks/hooks-merge.js";
import { CURSOR_HOOKS } from "../../../../../src/contexts/tools/domain/profiles/cursor/hooks.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { catalogOf, registeredProfile, TOOL } from "../../../tools/testing/catalog-of.js";

const ROOT = "/test-project";

function removalOver(
  manifest: Manifest | null,
  fs: InMemoryFileAdapter,
  repo = new InMemoryManifestRepository(manifest, ROOT),
  gitignore = new UpdateGitignore(fs)
): RemoveProjectFiles {
  return new RemoveProjectFiles(fs, repo, new CapturingLogger(), gitignore);
}

function localPlugin(name: string): InstalledPlugin {
  return InstalledPlugin.fromMetadata(
    name,
    "1.0.0",
    { kind: "local", path: "/p" },
    false,
    "project"
  );
}

describe("RemoveProjectFiles.remove", () => {
  it("deletes a project-scope plugin's files from the project and counts them", async () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    manifest.addPlugin(
      TOOL.claude,
      localPlugin("aidd-context").withFiles(
        new Map([["skills/x.md", createHash("md5").update("x").digest("hex")]])
      )
    );
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, "skills", "x.md"), "x");

    const count = await removalOver(manifest, fs).remove(catalogOf(), ROOT, true);

    expect(fs.has(join(ROOT, "skills", "x.md"))).toBe(false);
    expect(count).toBe(1);
  });

  it("removes nothing from a project that installed nothing", async () => {
    await expect(
      removalOver(null, new InMemoryFileAdapter()).remove(catalogOf(), ROOT, true)
    ).resolves.toBe(0);
  });

  it("asks no AI profile of a tool that is not an AI tool", async () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.vscode, "1.0.0", []);
    manifest.addPlugin(TOOL.vscode, localPlugin("ide-plugin"));

    await expect(
      removalOver(manifest, new InMemoryFileAdapter()).remove(catalogOf(), ROOT, false)
    ).resolves.toBe(0);
  });

  it("removes a hook script edited after install when forced", async () => {
    const script = `${pluginScriptDir(CURSOR_HOOKS.project.scriptsDir, "aidd-context")}run.js`;
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "1.0.0", []);
    manifest.addPlugin(
      TOOL.cursor,
      InstalledPlugin.withProjectHooks(localPlugin("aidd-context"), {
        entries: [],
        scripts: new Map([[script, createHash("md5").update("// installed").digest("hex")]]),
      })
    );
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, script), "// edited");

    await removalOver(manifest, fs).remove(catalogOf(), ROOT, true);

    expect(fs.has(join(ROOT, script))).toBe(false);
  });

  it("takes back every machine-local gitignore line the install added", async () => {
    const [machineLocal] = registeredProfile(TOOL.claude).machineLocalFiles();
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, ".gitignore"), `node_modules\n.aidd/cache/\n${machineLocal}\n`);

    await removalOver(manifest, fs).remove(catalogOf(), ROOT, true);

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

    await removalOver(manifest, fs, repo, gitignore).remove(catalogOf(), ROOT, true);

    expect(manifestWhenGitignoreIsTouched).toEqual([null]);
  });
});
