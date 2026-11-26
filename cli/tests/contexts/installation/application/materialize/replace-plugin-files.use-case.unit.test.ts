import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { builtPlacementOf } from "../../../../../src/composition/orchestration/built-placement.js";
import { ReplacePluginFiles } from "../../../../../src/contexts/installation/application/materialize/replace-plugin-files.use-case.js";
import type { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { loadDistributionOf } from "../../../../shared/testing/load-distribution.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
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
    manifest: { name: parsePluginName("sample-plugin"), version: "1.0.0" },
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
  const deps = await buildInstallationDeps({ tools: registeredTools() });
  await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
  deps.fs.setFile(join(PROJECT_ROOT, STALE_FILE), "old");
  const manifest = await deps.manifestRepo.load();
  if (manifest === null) throw new Error("manifest not found");
  const installed = RecordedPlugin.fromMetadata({
    name: "sample-plugin",
    version: "0.0.1",
    source: SOURCE,
    strict: false,
    scope: "project",
    marketplace,
  }).withFiles(new Map([[STALE_FILE, "old-hash"]]));
  manifest.addPlugin(TOOL.claude, installed);
  await new ReplacePluginFiles(
    { fs: deps.fs, ...builtPlacementOf(deps.fs, fakeBuiltDeps()) },
    registeredTools()
  ).execute({
    plugin: installed,
    dist: greetDistribution(),
    toolId: TOOL.claude,
    projectRoot: PROJECT_ROOT,
    manifest,
  });
  return {
    fs: deps.fs,
    entry: manifest.getRecordedPlugins(TOOL.claude).find((p) => p.plugin.name === "sample-plugin"),
  };
}

describe("replacing a plugin's files", () => {
  it("swaps the old files for the new ones for a plugin that came from a local path", async () => {
    const { fs, entry } = await replaceOnClaude(undefined);

    expect([
      fs.has(join(PROJECT_ROOT, STALE_FILE)),
      fs.has(join(PROJECT_ROOT, GREET_FILE)),
      entry?.plugin.version,
      entry?.plugin.files.has(GREET_FILE),
    ]).toStrictEqual([false, true, "1.0.0", true]);
  });

  it("registers a marketplace plugin again without writing any file", async () => {
    const { fs, entry } = await replaceOnClaude("aidd-framework");

    expect([
      fs.has(join(PROJECT_ROOT, STALE_FILE)),
      fs.has(join(PROJECT_ROOT, GREET_FILE)),
      entry?.marketplace,
      entry?.plugin.files.size,
    ]).toStrictEqual([false, false, "aidd-framework", 0]);
  });
});

describe("replacing a plugin that came from no marketplace", () => {
  const FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
  const HOOKS_FILE = join(PROJECT_ROOT, ".kiro/hooks/aidd.json");

  /** The project hooks file `place` leaves for the sample plugin on a tool that delivers hooks to the project. */
  async function hooksFileAfter(
    place: (ctx: {
      built: ReturnType<typeof builtPlacementOf>;
      dist: PluginDistribution;
      manifest: Manifest;
      fs: Awaited<ReturnType<typeof buildInstallationDeps>>["fs"];
    }) => Promise<void>
  ): Promise<string | undefined> {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, TOOL.kiro);
    await seedFromDirectory(deps.fs, FIXTURE, { useAbsolutePaths: true });
    const dist = await loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader)(
      { kind: "local", path: FIXTURE },
      "/cache"
    );
    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");
    await place({ built: builtPlacementOf(deps.fs, fakeBuiltDeps()), dist, manifest, fs: deps.fs });
    return deps.fs.has(HOOKS_FILE) ? await deps.fs.readFile(HOOKS_FILE) : undefined;
  }

  it("leaves the project hooks file a fresh install leaves", async () => {
    const tool = registeredTools().aiProfile(TOOL.kiro);
    const installed = await hooksFileAfter(async ({ built, dist, manifest }) => {
      await built.placeBuiltTree({
        dist,
        tool,
        source: { kind: "local", path: FIXTURE },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      });
    });
    const updated = await hooksFileAfter(async ({ built, dist, manifest, fs }) => {
      const old = RecordedPlugin.fromMetadata({
        name: "sample-plugin",
        version: "0.0.1",
        source: { kind: "local", path: FIXTURE },
        strict: false,
        scope: "project",
      });
      manifest.addPlugin(TOOL.kiro, old);
      await new ReplacePluginFiles({ fs, ...built }, registeredTools()).execute({
        plugin: old,
        dist,
        toolId: TOOL.kiro,
        projectRoot: PROJECT_ROOT,
        manifest,
      });
    });

    expect(installed).toContain("sample-plugin");
    expect(updated).toBe(installed);
  });
});
