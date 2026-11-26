import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AssertProjectRemovable } from "../../../../../src/contexts/installation/application/clean/assert-project-removable.use-case.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { projectIntegrationOver } from "../../../../shared/testing/project-integration.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../../shared/testing/saying.builder.js";
import { cursorHookScriptDir } from "../../testing/cursor-hook-scripts.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

const ROOT = "/test-project";

function cleanOver(manifest: Manifest | null, fs: InMemoryFileAdapter): AssertProjectRemovable {
  return new AssertProjectRemovable(
    {
      assertHooksRemovable: projectIntegrationOver(fs).assertHooksRemovable,
      manifestRepo: new InMemoryManifestRepository(manifest, ROOT),
      assertMcpRemovable: async () => undefined,
    },
    registeredTools()
  );
}

function localPlugin(name: string, scope: Scope = "project"): RecordedPlugin {
  return RecordedPlugin.fromMetadata({
    name,
    version: "1.0.0",
    source: { kind: "local", path: "/p" },
    strict: false,
    scope,
  });
}

describe("before removing a project's install", () => {
  it("refuses a hook script edited after install unless forced", async () => {
    const script = `${cursorHookScriptDir("aidd-context")}run.js`;
    const installed = FileHash.of("// installed").value;
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "1.0.0", []);
    const plugin = RecordedPlugin.fromMetadata({
      name: "aidd-context",
      version: "1.0.0",
      source: { kind: "local", path: "/p" },
      strict: false,
      scope: "project",
    });
    manifest.addPlugin(
      TOOL.cursor,
      plugin.withProjectHooks({
        entries: [],
        scripts: new Map([[script, installed]]),
      })
    );
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, script), "// edited");
    const clean = cleanOver(manifest, fs);

    await expect(clean.execute({ projectRoot: ROOT, force: false })).rejects.toThrow(
      saying("edited after install")
    );
    await expect(clean.execute({ projectRoot: ROOT, force: true })).resolves.toBeUndefined();
  });
});

describe("AssertProjectRemovable on a project that installed nothing", () => {
  it("proves nothing removable", async () => {
    const fs = new InMemoryFileAdapter();
    const clean = cleanOver(null, fs);

    await expect(clean.execute({ projectRoot: ROOT, force: false })).resolves.toBeUndefined();
  });
});

describe("AssertProjectRemovable over a tool that is not an AI tool", () => {
  function manifestWithIdePlugin(scope: Scope): Manifest {
    const manifest = aManifest()
      .withTool(TOOL.vscode, [])
      .withPlugin(TOOL.vscode, localPlugin("ide-plugin", scope))
      .build();
    return manifest;
  }

  it("asks no AI profile of it when proving removal", async () => {
    const clean = cleanOver(manifestWithIdePlugin("project"), new InMemoryFileAdapter());

    await expect(clean.execute({ projectRoot: ROOT, force: false })).resolves.toBeUndefined();
  });
});
