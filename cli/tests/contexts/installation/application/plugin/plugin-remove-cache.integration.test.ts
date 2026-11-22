/**
 * Unlike `clean`'s codex path, this purge is never gated on emptiness: the plugin's cache is
 * what the removal asks the host to forget, so it goes only once the host confirms.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { registerMarketplacePlugin } from "../../../../../src/contexts/installation/application/materialize/register-marketplace-plugin.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeHostPluginRegistry } from "../../testing/fake-host-plugin-registry.fake.js";
import { pluginRemover } from "../../testing/plugin-remover.builder.js";

const PROJECT_ROOT = "/test-project";
const ALIAS = "my-local-alias";
const HOST_NAME = "upstream-catalog-name";
const PLUGIN_NAME = "aidd-telemetry";
// The host is addressed by `hostName`, never by `ALIAS`, this project's own local key,
// which a host never learns.
const REF = `${PLUGIN_NAME}@${HOST_NAME}`;
const CLAUDE_CACHE_ROOT = join(homedir(), ".claude", "plugins", "cache");

function buildDist(): PluginDistribution {
  return new PluginDistribution({
    manifest: { name: PLUGIN_NAME, version: "1.0.0" },
    format: TOOL.claude,
    files: [{ relativePath: "commands/hello.md", content: "# Hello" }],
    components: {
      commands: [{ relativePath: "commands/hello.md", content: "# Hello" }],
      agents: [],
      rules: [],
      skills: [],
      hooks: [],
      mcp: [],
    },
  });
}

async function seededRepository(): Promise<InMemoryManifestRepository> {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "test", []);
  await registerMarketplacePlugin({
    dist: buildDist(),
    tool: registeredTools().aiProfile(TOOL.claude),
    source: { kind: "local", path: "/plugin-source" },
    projectRoot: PROJECT_ROOT,
    manifest,
    marketplace: ALIAS,
  });
  // hostName differs from this project's own local alias - the same divergence
  // `clean`'s own marketplace cache purge already addresses by hostName, never alias.
  const records = new Map([
    [
      TOOL.claude,
      {
        binary: "claude",
        marketplaces: [
          {
            alias: ALIAS,
            hostName: HOST_NAME,
            provenance: { kind: "registry", source: "/plugin-source" },
          },
        ],
        pluginRefs: [REF],
      },
    ],
  ]);
  return new InMemoryManifestRepository(manifest, PROJECT_ROOT, records);
}

function verifiedClaudeRemoval(
  fs: InMemoryFileAdapter,
  repo: InMemoryManifestRepository,
  logger: CapturingLogger,
  activator: FakeHostActions
): ReturnType<typeof pluginRemover> {
  return pluginRemover({
    fs,
    manifestRepo: repo,
    logger,
    activators: new Map([[TOOL.claude, activator]]),
    hostPluginRegistries: new Map([
      [
        TOOL.claude,
        new FakeHostPluginRegistry({
          location: "/host/plugin-registry",
          refs: new Map([
            [REF, { enabled: true, scope: "project" }],
            [`other-plugin@${HOST_NAME}`, { enabled: true, scope: "project" }],
            [`${PLUGIN_NAME}@../../../evil`, { enabled: true, scope: "project" }],
          ]),
        }),
      ],
    ]),
    nativeMarketplaceSources: new Map([
      [
        TOOL.claude,
        {
          read: async () => ({
            location: "/host/catalogue",
            entries: new Map([
              [HOST_NAME, { kind: "registry" as const, source: "/plugin-source" }],
              ["../../../evil", { kind: "registry" as const, source: "/plugin-source" }],
            ]),
          }),
        },
      ],
    ]),
  });
}

describe("RemovePlugin purges the plugin's own cache subtree", () => {
  it("purges cache/<hostName>/<plugin>/ once the host confirms it uninstalled, even with content still inside", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const cacheEntry = join(CLAUDE_CACHE_ROOT, HOST_NAME, PLUGIN_NAME, "1.0.0", "plugin.json");
    const foreignCacheEntry = join(
      CLAUDE_CACHE_ROOT,
      HOST_NAME,
      "other-plugin",
      "1.0.0",
      "plugin.json"
    );
    await fs.writeFile(cacheEntry, "{}");
    await fs.writeFile(foreignCacheEntry, "foreign bytes");
    const manifestRepo = await seededRepository();
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();
    const removeUseCase = verifiedClaudeRemoval(fs, manifestRepo, logger, activator);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([REF]);
    expect(await fs.fileExists(cacheEntry)).toBe(false);
    expect(fs.getFile(foreignCacheEntry)).toBe("foreign bytes");
  });

  it("leaves the plugin's cache in place, and names it, when the host CLI is not on PATH", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const cacheEntry = join(CLAUDE_CACHE_ROOT, HOST_NAME, PLUGIN_NAME, "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");
    const manifestRepo = await seededRepository();
    const activator = new FakeHostActions({ available: false });
    const logger = new CapturingLogger();
    const removeUseCase = verifiedClaudeRemoval(fs, manifestRepo, logger, activator);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(await fs.fileExists(cacheEntry)).toBe(true);
    expect(logger.warnMessages.some((m) => m.includes("its own removal was not confirmed"))).toBe(
      true
    );
  });

  it("leaves the plugin's cache in place when the host CLI reports the plugin already absent", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const cacheEntry = join(CLAUDE_CACHE_ROOT, HOST_NAME, PLUGIN_NAME, "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");
    const manifestRepo = await seededRepository();
    const activator = new FakeHostActions({ available: true, failOnUninstall: [REF] });
    const logger = new CapturingLogger();
    const removeUseCase = verifiedClaudeRemoval(fs, manifestRepo, logger, activator);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(await fs.fileExists(cacheEntry)).toBe(true);
  });

  it("refuses a '..' segment in a manifest's own hostName, never purging outside the declared cache root", async () => {
    const evilHostName = "../../../evil";
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT, CLAUDE_CACHE_ROOT]);
    const witness = join(CLAUDE_CACHE_ROOT, evilHostName, PLUGIN_NAME, "keep-me.txt");
    await fs.writeFile(witness, "still here");
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "test", []);
    await registerMarketplacePlugin({
      dist: buildDist(),
      tool: registeredTools().aiProfile(TOOL.claude),
      source: { kind: "local", path: "/plugin-source" },
      projectRoot: PROJECT_ROOT,
      manifest,
      marketplace: ALIAS,
    });
    const records = new Map([
      [
        TOOL.claude,
        {
          binary: "claude",
          marketplaces: [
            {
              alias: ALIAS,
              hostName: evilHostName,
              provenance: { kind: "registry", source: "/plugin-source" },
            },
          ],
          pluginRefs: [`${PLUGIN_NAME}@${evilHostName}`],
        },
      ],
    ]);
    const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT, records);
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();
    const removeUseCase = verifiedClaudeRemoval(fs, manifestRepo, logger, activator);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(await fs.fileExists(witness)).toBe(true);
    expect(logger.warnMessages.some((m) => m.includes("does not resolve inside"))).toBe(true);
  });

  it("names the purged cache directory", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    await fs.writeFile(
      join(CLAUDE_CACHE_ROOT, HOST_NAME, PLUGIN_NAME, "1.0.0", "plugin.json"),
      "{}"
    );
    const manifestRepo = await seededRepository();
    const logger = new CapturingLogger();
    const removeUseCase = verifiedClaudeRemoval(
      fs,
      manifestRepo,
      logger,
      new FakeHostActions({ available: true })
    );

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(logger.infoMessages).toStrictEqual([
      `claude: cache for '${PLUGIN_NAME}' purged: ${join(CLAUDE_CACHE_ROOT, HOST_NAME, PLUGIN_NAME)}`,
    ]);
  });

  it("leaves the cache alone, silently, when no activator drives this tool", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const cacheEntry = join(CLAUDE_CACHE_ROOT, HOST_NAME, PLUGIN_NAME, "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");
    const manifestRepo = await seededRepository();
    const logger = new CapturingLogger();
    const removeUseCase = pluginRemover({ fs, manifestRepo, logger });

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(await fs.fileExists(cacheEntry)).toBe(true);
    expect(logger.allMessages).toStrictEqual([]);
  });

  it("refuses Copilot removal without current source proof, preserving its manifest and files", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const manifest = Manifest.create();
    manifest.addTool(TOOL.copilot, "test", []);
    await registerMarketplacePlugin({
      dist: buildDist(),
      tool: registeredTools().aiProfile(TOOL.copilot),
      source: { kind: "local", path: "/plugin-source" },
      projectRoot: PROJECT_ROOT,
      manifest,
      marketplace: ALIAS,
    });
    const records = new Map([
      [
        TOOL.copilot,
        {
          binary: "copilot",
          marketplaces: [
            {
              alias: ALIAS,
              hostName: HOST_NAME,
              provenance: { kind: "registry", source: "/plugin-source" },
            },
          ],
          pluginRefs: [REF],
        },
      ],
    ]);
    const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT, records);
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();
    const removeUseCase = pluginRemover({
      fs,
      manifestRepo,
      logger,
      activators: new Map([[TOOL.copilot, activator]]),
    });

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: [TOOL.copilot],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/unclaimed machine-global host ref/);

    expect(activator.uninstalledPlugins).toStrictEqual([]);
    expect(manifestRepo.getCurrent()?.getPlugins(TOOL.copilot)).toHaveLength(1);
    expect(manifestRepo.records.get(TOOL.copilot)?.pluginRefs).toEqual([REF]);
  });
});
