import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DetectPluginDrift } from "../../../../../src/contexts/installation/application/shared/detect-plugin-drift.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = "/proj";
const USER_PLUGINS_DIR = join(homedir(), ".cursor", "plugins", "local");
const HASH_OF_ONE = FileHash.of("one").value;
const HASH_OF_TWO = FileHash.of("two").value;

function manifestWith(plugins: Record<string, Record<string, string>>): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.cursor, "1.0.0", []);
  for (const [name, files] of Object.entries(plugins)) {
    manifest.addPlugin(
      TOOL.cursor,
      InstalledPlugin.fromJSON({
        name,
        source: { kind: "local", path: "/some/path" },
        version: "1.0.0",
        strict: false,
        files,
        scope: "user",
      })
    );
  }
  return manifest;
}

describe("DetectPluginDrift", () => {
  it("narrows the report to the plugin it was asked about", async () => {
    const manifest = manifestWith({
      "aidd-one": { "aidd-one/a.md": HASH_OF_ONE },
      "aidd-two": { "aidd-two/a.md": HASH_OF_ONE },
    });
    const useCase = new DetectPluginDrift(new InMemoryFileAdapter({}), registeredTools());

    const drifts = await useCase.execute({
      manifest,
      projectRoot: PROJECT_ROOT,
      toolIds: [TOOL.cursor],
      pluginName: "aidd-two",
    });

    expect(drifts).toStrictEqual([
      { toolId: TOOL.cursor, pluginName: "aidd-two", files: [], notInstalledOnMachine: true },
    ]);
  });

  it("reports one missing and one changed file as drift, never as a plugin absent from this machine", async () => {
    const manifest = manifestWith({
      "aidd-one": { "aidd-one/gone.md": HASH_OF_ONE, "aidd-one/changed.md": HASH_OF_ONE },
    });
    const fs = new InMemoryFileAdapter({
      [join(USER_PLUGINS_DIR, "aidd-one", "changed.md")]: "two",
    });
    const useCase = new DetectPluginDrift(fs, registeredTools());

    const drifts = await useCase.execute({
      manifest,
      projectRoot: PROJECT_ROOT,
      toolIds: [TOOL.cursor],
    });

    expect(HASH_OF_TWO).not.toBe(HASH_OF_ONE);
    expect(drifts).toStrictEqual([
      {
        toolId: TOOL.cursor,
        pluginName: "aidd-one",
        files: [
          { relativePath: "aidd-one/gone.md", kind: "missing" },
          { relativePath: "aidd-one/changed.md", kind: "hash-mismatch" },
        ],
        notInstalledOnMachine: false,
      },
    ]);
  });
});
