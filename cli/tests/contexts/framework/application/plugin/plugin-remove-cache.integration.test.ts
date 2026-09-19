/**
 * Unlike `clean`'s codex path, this purge is never gated on emptiness: the plugin's cache is
 * what the removal asks the host to forget, so it goes only once the host confirms.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { ModeAMarketplaceTranslator } from "../../../../../src/contexts/framework/application/framework/translator/mode-a-marketplace-translator.js";
import { PluginRemoveUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-remove-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { PluginDistribution } from "../../../../../src/contexts/translate/domain/plugin-distribution.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { FakeHostPluginRegistryReader } from "../../../../helpers/ports/fake-host-plugin-registry-reader.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";

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
    format: "claude",
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

async function seedManifest(): Promise<Manifest> {
  const manifest = Manifest.create();
  manifest.addTool("claude", "test", []);
  await new ModeAMarketplaceTranslator().addPlugin(
    buildDist(),
    "claude",
    { kind: "local", path: "/plugin-source" },
    PROJECT_ROOT,
    manifest,
    ALIAS
  );
  // hostName differs from this project's own local alias — the same divergence
  // `clean`'s own marketplace cache purge already addresses by hostName, never alias.
  manifest.setNativeRegistrations("claude", {
    binary: "claude",
    marketplaces: [
      {
        alias: ALIAS,
        hostName: HOST_NAME,
        provenance: { kind: "registry", source: "/plugin-source" },
      },
    ],
    pluginRefs: [REF],
  });
  return manifest;
}

function verifiedClaudeRemoval(
  fs: InMemoryFileAdapter,
  repo: InMemoryManifestRepository,
  logger: CapturingLogger,
  activator: FakeNativePluginActivator
): PluginRemoveUseCase {
  return new PluginRemoveUseCase(
    fs,
    repo,
    logger,
    new Map([["claude", activator]]),
    new Map([
      [
        "claude",
        new FakeHostPluginRegistryReader({
          location: "/host/plugin-registry",
          refs: new Map([
            [REF, { enabled: true, scope: "project" }],
            [`other-plugin@${HOST_NAME}`, { enabled: true, scope: "project" }],
            [`${PLUGIN_NAME}@../../../evil`, { enabled: true, scope: "project" }],
          ]),
        }),
      ],
    ]),
    undefined,
    undefined,
    undefined,
    new Map([
      [
        "claude",
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
    ])
  );
}

describe("PluginRemoveUseCase purges the plugin's own cache subtree", () => {
  it("purges cache/<hostName>/<plugin>/ once the host confirms it uninstalled, even with content still inside", async () => {
    const fs = new InMemoryFileAdapter();
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
    const manifestRepo = new InMemoryManifestRepository(await seedManifest(), PROJECT_ROOT);
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const removeUseCase = verifiedClaudeRemoval(fs, manifestRepo, logger, activator);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([REF]);
    expect(await fs.fileExists(cacheEntry)).toBe(false);
    expect(fs.getFile(foreignCacheEntry)).toBe("foreign bytes");
  });

  it("leaves the plugin's cache in place, and names it, when the host CLI is not on PATH", async () => {
    const fs = new InMemoryFileAdapter();
    const cacheEntry = join(CLAUDE_CACHE_ROOT, HOST_NAME, PLUGIN_NAME, "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");
    const manifestRepo = new InMemoryManifestRepository(await seedManifest(), PROJECT_ROOT);
    const activator = new FakeNativePluginActivator({ available: false });
    const logger = new CapturingLogger();
    const removeUseCase = verifiedClaudeRemoval(fs, manifestRepo, logger, activator);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(await fs.fileExists(cacheEntry)).toBe(true);
    expect(logger.warnMessages.some((m) => m.includes("its own removal was not confirmed"))).toBe(
      true
    );
  });

  it("leaves the plugin's cache in place when the host CLI reports the plugin already absent", async () => {
    const fs = new InMemoryFileAdapter();
    const cacheEntry = join(CLAUDE_CACHE_ROOT, HOST_NAME, PLUGIN_NAME, "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");
    const manifestRepo = new InMemoryManifestRepository(await seedManifest(), PROJECT_ROOT);
    const activator = new FakeNativePluginActivator({ available: true, failOnUninstall: [REF] });
    const logger = new CapturingLogger();
    const removeUseCase = verifiedClaudeRemoval(fs, manifestRepo, logger, activator);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(await fs.fileExists(cacheEntry)).toBe(true);
  });

  it("refuses a '..' segment in a manifest's own hostName, never purging outside the declared cache root", async () => {
    const evilHostName = "../../../evil";
    const fs = new InMemoryFileAdapter();
    const witness = join(CLAUDE_CACHE_ROOT, evilHostName, PLUGIN_NAME, "keep-me.txt");
    await fs.writeFile(witness, "still here");
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await new ModeAMarketplaceTranslator().addPlugin(
      buildDist(),
      "claude",
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      ALIAS
    );
    manifest.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [
        {
          alias: ALIAS,
          hostName: evilHostName,
          provenance: { kind: "registry", source: "/plugin-source" },
        },
      ],
      pluginRefs: [`${PLUGIN_NAME}@${evilHostName}`],
    });
    const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const removeUseCase = verifiedClaudeRemoval(fs, manifestRepo, logger, activator);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(await fs.fileExists(witness)).toBe(true);
    expect(logger.warnMessages.some((m) => m.includes("does not resolve inside"))).toBe(true);
  });

  it("names the purged cache directory", async () => {
    const fs = new InMemoryFileAdapter();
    await fs.writeFile(
      join(CLAUDE_CACHE_ROOT, HOST_NAME, PLUGIN_NAME, "1.0.0", "plugin.json"),
      "{}"
    );
    const manifestRepo = new InMemoryManifestRepository(await seedManifest(), PROJECT_ROOT);
    const logger = new CapturingLogger();
    const removeUseCase = verifiedClaudeRemoval(
      fs,
      manifestRepo,
      logger,
      new FakeNativePluginActivator({ available: true })
    );

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(logger.infoMessages).toStrictEqual([
      `claude: cache for '${PLUGIN_NAME}' purged: ${join(CLAUDE_CACHE_ROOT, HOST_NAME, PLUGIN_NAME)}`,
    ]);
  });

  it("leaves the cache alone, silently, when no activator drives this tool", async () => {
    const fs = new InMemoryFileAdapter();
    const cacheEntry = join(CLAUDE_CACHE_ROOT, HOST_NAME, PLUGIN_NAME, "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");
    const manifestRepo = new InMemoryManifestRepository(await seedManifest(), PROJECT_ROOT);
    const logger = new CapturingLogger();
    const removeUseCase = new PluginRemoveUseCase(fs, manifestRepo, logger, new Map());

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(await fs.fileExists(cacheEntry)).toBe(true);
    expect(logger.allMessages).toStrictEqual([]);
  });

  it("refuses Copilot removal without current source proof, preserving its manifest and files", async () => {
    const fs = new InMemoryFileAdapter();
    const manifest = Manifest.create();
    manifest.addTool("copilot", "test", []);
    await new ModeAMarketplaceTranslator().addPlugin(
      buildDist(),
      "copilot",
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      ALIAS
    );
    manifest.setNativeRegistrations("copilot", {
      binary: "copilot",
      marketplaces: [
        {
          alias: ALIAS,
          hostName: HOST_NAME,
          provenance: { kind: "registry", source: "/plugin-source" },
        },
      ],
      pluginRefs: [REF],
    });
    const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const removeUseCase = new PluginRemoveUseCase(
      fs,
      manifestRepo,
      logger,
      new Map([["copilot", activator]])
    );

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: ["copilot"],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/unclaimed machine-global host ref/);

    expect(activator.uninstalledPlugins).toStrictEqual([]);
    expect(manifestRepo.getCurrent()?.getPlugins("copilot")).toHaveLength(1);
    expect(manifestRepo.getCurrent()?.getNativeRegistrations("copilot")?.pluginRefs).toEqual([REF]);
  });
});
