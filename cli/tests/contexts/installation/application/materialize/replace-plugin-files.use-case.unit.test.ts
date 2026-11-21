import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ReplacePluginFiles } from "../../../../../src/contexts/installation/application/materialize/replace-plugin-files.use-case.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { fakeBuiltDeps } from "../../testing/fake-build-sources.fake.js";

const PLUGIN_SOURCE_PATH = "/plugin-source/sample-plugin";
const PROJECT_ROOT = "/test-project";
const STALE_FILE = ".claude/plugins/sample-plugin/stale.md";
const GREET_FILE = ".claude/plugins/sample-plugin/commands/greet.md";
const SOURCE = { kind: "local" as const, path: PLUGIN_SOURCE_PATH };

const GREET_COMMAND = { relativePath: "commands/greet.md", content: "# greet\n" };

/** A plugin version 1.0.0 carrying one command, as a distribution reader would hand it over. */
function greetDistribution(): PluginDistribution {
  return new PluginDistribution({
    manifest: { name: "sample-plugin", version: "1.0.0" },
    format: TOOL.claude,
    files: [GREET_COMMAND],
    components: {
      skills: [],
      commands: [GREET_COMMAND],
      agents: [],
      rules: [],
      hooks: [],
      mcp: [],
    },
  });
}

async function replaceOnClaude(marketplace: string | undefined) {
  const deps = await buildInstallationDeps();
  await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
  deps.fs.setFile(join(PROJECT_ROOT, STALE_FILE), "old");
  const manifest = await deps.manifestRepo.load();
  if (manifest === null) throw new Error("manifest not found");
  const installed = InstalledPlugin.fromMetadata({
    name: "sample-plugin",
    version: "0.0.1",
    source: SOURCE,
    strict: false,
    scope: "project",
    marketplace,
  }).withFiles(new Map([[STALE_FILE, "old-hash"]]));
  manifest.addPlugin(TOOL.claude, installed);
  await new ReplacePluginFiles(deps.fs, fakeBuiltDeps(), registeredTools()).execute({
    plugin: installed,
    dist: greetDistribution(),
    toolId: TOOL.claude,
    projectRoot: PROJECT_ROOT,
    manifest,
  });
  return {
    fs: deps.fs,
    entry: manifest.getPlugins(TOOL.claude).find((p) => p.name === "sample-plugin"),
  };
}

describe("ReplacePluginFiles", () => {
  it("swaps the old files for the new ones for a plugin that came from a local path", async () => {
    const { fs, entry } = await replaceOnClaude(undefined);

    expect([
      fs.has(join(PROJECT_ROOT, STALE_FILE)),
      fs.has(join(PROJECT_ROOT, GREET_FILE)),
      entry?.version,
      entry?.files.has(GREET_FILE),
    ]).toStrictEqual([false, true, "1.0.0", true]);
  });

  it("registers a marketplace plugin again without writing any file", async () => {
    const { fs, entry } = await replaceOnClaude("aidd-framework");

    expect([
      fs.has(join(PROJECT_ROOT, STALE_FILE)),
      fs.has(join(PROJECT_ROOT, GREET_FILE)),
      entry?.marketplace,
      entry?.files.size,
    ]).toStrictEqual([false, false, "aidd-framework", 0]);
  });
});
