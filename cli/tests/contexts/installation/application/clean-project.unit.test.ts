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
import { catalogOf, registeredProfile, TOOL } from "../../tools/testing/catalog-of.js";

const ROOT = "/test-project";

function cleanOver(manifest: Manifest | null, fs: InMemoryFileAdapter): CleanProject {
  return new CleanProject(
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
}

function localPlugin(name: string, scope: "project" | "user" = "project"): InstalledPlugin {
  return InstalledPlugin.fromMetadata(name, "1.0.0", { kind: "local", path: "/p" }, false, scope);
}

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

describe("CleanProject on a project that installed nothing", () => {
  it("proves nothing removable and removes nothing", async () => {
    const fs = new InMemoryFileAdapter();
    const clean = cleanOver(null, fs);

    await expect(clean.assertRemovable(catalogOf(), ROOT, false)).resolves.toBeUndefined();
    await expect(clean.remove(catalogOf(), ROOT, true)).resolves.toBe(0);
  });
});

describe("CleanProject over a tool that is not an AI tool", () => {
  function manifestWithIdePlugin(scope: "project" | "user"): Manifest {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.vscode, "1.0.0", []);
    manifest.addPlugin(TOOL.vscode, localPlugin("ide-plugin", scope));
    return manifest;
  }

  it("asks no AI profile of it when proving removal", async () => {
    const clean = cleanOver(manifestWithIdePlugin("project"), new InMemoryFileAdapter());

    await expect(clean.assertRemovable(catalogOf(), ROOT, false)).resolves.toBeUndefined();
  });

  it("asks no AI profile of it when removing", async () => {
    const clean = cleanOver(manifestWithIdePlugin("project"), new InMemoryFileAdapter());

    await expect(clean.remove(catalogOf(), ROOT, false)).resolves.toBe(0);
  });

  it("leaves it out of the user plugins a plan lists", async () => {
    const clean = cleanOver(manifestWithIdePlugin("user"), new InMemoryFileAdapter());

    const plan = await clean.plan(catalogOf());

    expect(plan?.userPlugins).toEqual([]);
  });
});

describe("CleanProject.remove with force", () => {
  it("removes a hook script edited after install", async () => {
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

    await cleanOver(manifest, fs).remove(catalogOf(), ROOT, true);

    expect(fs.has(join(ROOT, script))).toBe(false);
  });
});

describe("CleanProject.remove gitignore", () => {
  it("takes back every machine-local line the install added", async () => {
    const [machineLocal] = registeredProfile(TOOL.claude).machineLocalFiles();
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, ".gitignore"), `node_modules\n.aidd/cache/\n${machineLocal}\n`);

    await cleanOver(manifest, fs).remove(catalogOf(), ROOT, true);

    expect(await fs.readFile(join(ROOT, ".gitignore"))).toBe("node_modules\n");
  });
});

describe("CleanProject.plan registrations", () => {
  it("keys a ref scope only for a plugin the host registered", async () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.codex, "1.0.0", []);
    manifest.addPlugin(TOOL.codex, localPlugin("unregistered"));
    manifest.setNativeRegistrations(TOOL.codex, {
      binary: "codex",
      marketplaces: [{ alias: "aidd", hostName: "aidd" }],
      pluginRefs: [],
    });

    const plan = await cleanOver(manifest, new InMemoryFileAdapter()).plan(catalogOf());

    expect(plan?.withdrawals.map((w) => w.refScopes.size)).toEqual([0]);
  });
});
