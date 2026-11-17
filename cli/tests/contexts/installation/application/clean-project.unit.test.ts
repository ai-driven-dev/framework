import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../../src/composition/installation.js";
import { CleanProject } from "../../../../src/contexts/installation/application/clean-project.js";
import { UpdateGitignore } from "../../../../src/contexts/installation/application/update-gitignore.js";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { pluginScriptDir } from "../../../../src/contexts/tools/domain/hooks/hooks-merge.js";
import { CURSOR_HOOKS } from "../../../../src/contexts/tools/domain/profiles/cursor/hooks.js";
import { CapturingLogger } from "../../../helpers/ports/capturing-logger.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../helpers/ports/in-memory-manifest-repository.js";
import { catalogOf, TOOL } from "../../tools/testing/catalog-of.js";

const ROOT = "/test-project";

describe("CleanProject.assertRemovable", () => {
  it("refuses a hook script edited after install unless forced", async () => {
    const script = `${pluginScriptDir(CURSOR_HOOKS.project.scriptsDir, "aidd-context")}run.js`;
    const installed = createHash("md5").update("// installed").digest("hex");
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "1.0.0", []);
    const plugin = InstalledPlugin.fromMetadata(
      "aidd-context",
      "1.0.0",
      { kind: "local", path: "/p" },
      false,
      "project"
    );
    manifest.addPlugin(
      TOOL.cursor,
      InstalledPlugin.withProjectHooks(plugin, {
        entries: [],
        scripts: new Map([[script, installed]]),
      })
    );
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, script), "// edited");
    const clean = new CleanProject(
      fs,
      new InMemoryManifestRepository(manifest, ROOT),
      new CapturingLogger(),
      new UpdateGitignore(fs),
      {
        homeDir: () => "/home",
        assertMcpRemovable: async () => undefined,
        records: registrationRecordRules,
      }
    );

    await expect(clean.assertRemovable(catalogOf(), ROOT, false)).rejects.toThrow(
      "edited after install"
    );
    await expect(clean.assertRemovable(catalogOf(), ROOT, true)).resolves.toBeUndefined();
  });
});

describe("CleanProject.remove", () => {
  it("deletes a project-scope plugin's files from the project and counts them", async () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    manifest.addPlugin(
      TOOL.claude,
      InstalledPlugin.fromMetadata(
        "aidd-context",
        "1.0.0",
        { kind: "local", path: "/p" },
        false,
        "project"
      ).withFiles(new Map([["skills/x.md", createHash("md5").update("x").digest("hex")]]))
    );
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, "skills", "x.md"), "x");
    const clean = new CleanProject(
      fs,
      new InMemoryManifestRepository(manifest, ROOT),
      new CapturingLogger(),
      new UpdateGitignore(fs),
      {
        homeDir: () => "/home",
        assertMcpRemovable: async () => undefined,
        records: registrationRecordRules,
      }
    );

    const count = await clean.remove(catalogOf(), ROOT, true);

    expect(fs.has(join(ROOT, "skills", "x.md"))).toBe(false);
    expect(count).toBe(1);
  });
});
