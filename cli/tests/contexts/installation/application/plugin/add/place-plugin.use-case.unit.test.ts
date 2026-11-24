import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { placePluginOf } from "../../../../../../src/composition/orchestration/built-placement.js";
import { toolPlacementOf } from "../../../../../../src/contexts/installation/application/plugin/add/place-plugin.use-case.js";
import { ResolveAddedPluginSource } from "../../../../../../src/contexts/installation/application/plugin/add/resolve-added-plugin-source.use-case.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { FileHash } from "../../../../../../src/shared/domain/file-hash.js";
import { PluginDistribution } from "../../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../../src/shared/domain/plugin/plugin-name.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../../shared/testing/installation-deps.builder.js";
import { loadDistributionOf } from "../../../../../shared/testing/load-distribution.builder.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../../shared/testing/seed-from-directory.builder.js";
import { fakeBuiltDeps } from "../../../testing/fake-build-sources.fake.js";

const PROJECT_ROOT = "/test-project";
const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const GREET_PATH = join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md");
const SOURCE = { kind: "local" as const, path: PLUGIN_FIXTURE };
const OLD_RELATIVE = ".claude/plugins/sample-plugin/old.md";
const MANIFEST_RELATIVE = ".claude/plugins/sample-plugin/.claude-plugin/plugin.json";
const COPIED_MANIFEST = '{"name":"sample-plugin","strict":true}';

async function placeForClaude(replacing = false) {
  const deps = await buildInstallationDeps({ tools: registeredTools() });
  await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  if (replacing) deps.fs.setFile(join(PROJECT_ROOT, OLD_RELATIVE), "old");
  if (replacing) deps.fs.setFile(join(PROJECT_ROOT, MANIFEST_RELATIVE), COPIED_MANIFEST);
  const built = fakeBuiltDeps({
    marketplaceRegistry: deps.marketplaceRegistry,
    homedir: () => "/home/u",
  });
  const added = await new ResolveAddedPluginSource(
    {
      loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
    },
    registeredTools()
  ).execute({
    source: SOURCE,
    projectRoot: PROJECT_ROOT,
    toolIds: [TOOL.claude],
    githubMarketplace: false,
  });
  if (added.isGithubMarketplace) throw new Error("a local add reads its distribution");
  const manifest = await deps.manifestRepo.load();
  if (manifest === null) throw new Error("the project manifest was not initialised");
  const logger = new CapturingLogger();
  const refreshed: string[] = [];
  await placePluginOf(
    {
      fs: deps.fs,
      logger,
      built: built,
      pluginRuntime: {
        execute: async (tool) => {
          refreshed.push(tool.toolId);
        },
      },
    },
    registeredTools()
  ).execute({
    dist: added.distribution,
    toolIds: [TOOL.claude],
    source: SOURCE,
    projectRoot: PROJECT_ROOT,
    manifest,
    machine: Manifest.create(),
    marketplace: undefined,
    previousMcpEntries: new Map(),
    previousProjectHooks: new Map(),
    previousFiles: new Map(
      replacing
        ? [
            [
              TOOL.claude,
              new Map([
                [OLD_RELATIVE, FileHash.of("old").value],
                [MANIFEST_RELATIVE, FileHash.of(COPIED_MANIFEST).value],
              ]),
            ],
          ]
        : []
    ),
  });
  return { deps, manifest, refreshed };
}

describe("placing a plugin in a project", () => {
  it("writes the plugin's files and records the plugin in the project manifest", async () => {
    const { deps, manifest } = await placeForClaude();

    const plugin = manifest.getPlugins(TOOL.claude).find((p) => p.name === "sample-plugin");
    expect([deps.fs.has(GREET_PATH), plugin?.scope]).toStrictEqual([true, "project"]);
  });

  it("removes a file the replaced version placed and this one no longer ships", async () => {
    const { deps } = await placeForClaude(true);

    expect([deps.fs.has(join(PROJECT_ROOT, OLD_RELATIVE)), deps.fs.has(GREET_PATH)]).toStrictEqual([
      false,
      true,
    ]);
  });

  it("overwrites the byte-copied manifest an earlier release placed with the synthesized one", async () => {
    const { deps } = await placeForClaude(true);

    const written = deps.fs.getFile(join(PROJECT_ROOT, MANIFEST_RELATIVE)) ?? "{}";
    expect(JSON.parse(written)).not.toHaveProperty("strict");
    expect(written).not.toBe(COPIED_MANIFEST);
  });

  it("refreshes the runtime files of each tool it places for", async () => {
    const { refreshed } = await placeForClaude();

    expect(refreshed).toStrictEqual([TOOL.claude]);
  });
});

describe("placing a plugin for one tool", () => {
  const recorded = new Map([[TOOL.cursor, new Map([["rules/old.mdc", "hash"]])]]);

  async function previousFilesHanded(userScopeDirTaken: boolean) {
    const seen: (ReadonlyMap<string, string> | undefined)[] = [];
    const placeForTool = toolPlacementOf({
      fs: new InMemoryFileAdapter(),
      translate: fakeBuiltDeps().translate,
      placeBuiltTree: async (request) => {
        seen.push(request.previousFiles);
        return { skipped: [] };
      },
    });
    await placeForTool({
      command: {
        dist: new PluginDistribution({
          manifest: { name: parsePluginName("sample-plugin"), version: "1.0.0" },
          format: TOOL.claude,
          files: [],
          components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
        }),
        toolIds: [TOOL.cursor],
        source: SOURCE,
        projectRoot: PROJECT_ROOT,
        manifest: Manifest.create(),
        machine: Manifest.create(),
        marketplace: undefined,
        previousMcpEntries: new Map(),
        previousProjectHooks: new Map(),
        previousFiles: recorded,
      },
      tool: registeredTools().aiProfile(TOOL.cursor),
      userScopeDirTaken,
    });
    return seen[0];
  }

  it("hands the placer the files a previous install recorded", async () => {
    expect(await previousFilesHanded(false)).toBe(recorded.get(TOOL.cursor));
  });

  it("hides them when the user-scope directory belongs to someone else", async () => {
    expect(await previousFilesHanded(true)).toBeUndefined();
  });
});
