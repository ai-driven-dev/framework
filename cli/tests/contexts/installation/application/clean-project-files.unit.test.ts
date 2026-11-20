import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../../src/composition/installation.js";
import { CleanProjectFiles } from "../../../../src/contexts/installation/application/clean-project-files.js";
import { RemoveProjectFiles } from "../../../../src/contexts/installation/application/removal/remove-project-files.js";
import { UpdateGitignore } from "../../../../src/contexts/installation/application/update-gitignore.js";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { FileHash } from "../../../../src/shared/domain/file.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.js";
import { cursorHookScriptDir } from "../testing/cursor-hook-scripts.js";
import { InMemoryManifestRepository } from "../testing/in-memory-manifest-repository.js";
import { aManifest } from "../testing/manifest-builder.js";

const ROOT = "/test-project";

function cleanOver(manifest: Manifest | null, fs: InMemoryFileAdapter): CleanProjectFiles {
  const repo = new InMemoryManifestRepository(manifest, ROOT);
  return new CleanProjectFiles(
    fs,
    repo,
    {
      homeDir: () => "/home",
      assertMcpRemovable: async () => undefined,
      records: registrationRecordRules,
    },
    new RemoveProjectFiles(
      fs,
      repo,
      new CapturingLogger(),
      new UpdateGitignore(fs),
      registeredTools()
    ),
    registeredTools()
  );
}

function localPlugin(name: string, scope: "project" | "user" = "project"): InstalledPlugin {
  return InstalledPlugin.fromMetadata(name, "1.0.0", { kind: "local", path: "/p" }, false, scope);
}

describe("CleanProjectFiles.assertRemovable", () => {
  it("refuses a hook script edited after install unless forced", async () => {
    const script = `${cursorHookScriptDir("aidd-context")}run.js`;
    const installed = FileHash.of("// installed").value;
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
    const clean = cleanOver(manifest, fs);

    await expect(clean.assertRemovable(ROOT, false)).rejects.toThrow("edited after install");
    await expect(clean.assertRemovable(ROOT, true)).resolves.toBeUndefined();
  });
});

describe("CleanProjectFiles.assertRemovable on a project that installed nothing", () => {
  it("proves nothing removable", async () => {
    const fs = new InMemoryFileAdapter();
    const clean = cleanOver(null, fs);

    await expect(clean.assertRemovable(ROOT, false)).resolves.toBeUndefined();
  });
});

describe("CleanProjectFiles over a tool that is not an AI tool", () => {
  function manifestWithIdePlugin(scope: "project" | "user"): Manifest {
    const manifest = aManifest()
      .withTool(TOOL.vscode, [])
      .withPlugin(TOOL.vscode, localPlugin("ide-plugin", scope))
      .build();
    return manifest;
  }

  it("asks no AI profile of it when proving removal", async () => {
    const clean = cleanOver(manifestWithIdePlugin("project"), new InMemoryFileAdapter());

    await expect(clean.assertRemovable(ROOT, false)).resolves.toBeUndefined();
  });

  it("leaves it out of the user plugins a plan lists", async () => {
    const clean = cleanOver(manifestWithIdePlugin("user"), new InMemoryFileAdapter());

    const plan = await clean.plan();

    expect(plan?.userPlugins).toEqual([]);
  });
});

describe("CleanProjectFiles.plan registrations", () => {
  it("keys a ref scope only for a plugin the host registered", async () => {
    const manifest = aManifest()
      .withTool(TOOL.codex, [])
      .withPlugin(TOOL.codex, localPlugin("unregistered"))
      .build();
    manifest.setNativeRegistrations(TOOL.codex, {
      binary: "codex",
      marketplaces: [{ alias: "aidd", hostName: "aidd" }],
      pluginRefs: [],
    });

    const plan = await cleanOver(manifest, new InMemoryFileAdapter()).plan();

    expect(plan?.withdrawals.map((w) => w.refScopes.size)).toEqual([0]);
  });
});
