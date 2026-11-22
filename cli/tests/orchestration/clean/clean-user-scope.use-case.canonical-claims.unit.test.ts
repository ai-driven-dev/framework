import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { RegistrationRecords } from "../../../src/contexts/installation/ports/record/registration-records.js";
import { FakeHostPluginRegistry } from "../../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { saying } from "../../shared/testing/saying.builder.js";
import {
  CLAUDE_CACHE,
  manifestWithClaude,
  provenClaudeSources,
  provenHostPlugins,
  RecordingActivator,
  RecordingFileAdapter,
  seedClaudeCache,
  USER_CONFIG_DIR,
} from "../testing/clean-user-scope.builder.js";
import { HOST, hostCatalog } from "../testing/synthetic-hosts.builder.js";
import { userScopeCleaner } from "../testing/user-scope-cleaner.builder.js";

describe("clean --scope user: canonical claims", () => {
  it.each([false, true])(
    "Copilot cleans past an unclaimed uninstall tombstone, but protects a foreign enabled=%s ref",
    async (foreignEnabled) => {
      const manifest = Manifest.create();
      manifest.addTool(HOST.copilot, "1.0.0", []);
      const source = {
        kind: "effective-list" as const,
        root: "/built/copilot",
        sourceType: "local",
        source: "/built/copilot",
      };
      const records: RegistrationRecords = new Map([
        [
          HOST.copilot,
          {
            binary: HOST.copilot,
            marketplaces: [
              { alias: "aidd-framework", hostName: "aidd-framework", provenance: source },
            ],
            pluginRefs: ["aidd-dev@aidd-framework"],
            pluginClaims: [{ ref: "aidd-dev@aidd-framework", dependents: [] }],
          },
        ],
      ]);
      const repo = new InMemoryManifestRepository(manifest, undefined, records);
      const hostRefs = new Map([
        ["aidd-dev@aidd-framework", { enabled: true }],
        ["aidd-pm@aidd-framework", { enabled: foreignEnabled }],
      ]);
      const activator = new FakeHostActions({ available: true });
      const clean = userScopeCleaner({
        tools: hostCatalog(),
        repo,
        activators: new Map([[HOST.copilot, activator]]),
        sources: new Map([
          [
            HOST.copilot,
            {
              read: async () => ({
                location: "marketplace list",
                entries: new Map([["aidd-framework", source]]),
              }),
            },
          ],
        ]),
        pluginRegistries: new Map([
          [HOST.copilot, new FakeHostPluginRegistry({ location: "plugins", refs: hostRefs })],
        ]),
      });

      const result = clean.execute({
        projectRoot: "/project",
        force: true,
      });

      if (foreignEnabled) {
        await expect(result).rejects.toThrow(/foreign host ref 'aidd-pm@aidd-framework'/);
        expect(activator.uninstalledPlugins).toEqual([]);
        expect(activator.removedMarketplaces).toEqual([]);
        expect(repo.getCurrent()).not.toBeNull();
      } else {
        await expect(result).resolves.toMatchObject({ dryRun: false });
        expect(activator.uninstalledPlugins).toEqual(["aidd-dev@aidd-framework"]);
        expect(activator.removedMarketplaces).toEqual(["aidd-framework"]);
        expect(repo.getCurrent()).toBeNull();
      }
    }
  );

  it("reads canonical dependents after acquiring the machine lock", async () => {
    const { manifest: machine, records } = manifestWithClaude(HOST);
    class LockedRepository extends InMemoryManifestRepository {
      async withExclusiveAccess<T>(action: () => Promise<T>): Promise<T> {
        // A concurrent install completed while clean was waiting for the lock.
        const registration = this.records.get(HOST.claude);
        if (registration === undefined) throw new Error("fixture missing native registration");
        this.records.set(HOST.claude, {
          ...registration,
          pluginClaims: [{ ref: "aidd-context@aidd-framework", dependents: ["/project-b"] }],
        });
        return action();
      }
    }
    const repo = new LockedRepository(machine, undefined, records);
    const fs = new RecordingFileAdapter();
    const cacheMarker = join(seedClaudeCache(fs), "marker.json");
    const sourceMarker = join(USER_CONFIG_DIR, "cache", "built", "1.0.0", "catalogue.json");
    fs.setFile(sourceMarker, "source");
    const fetched = join(
      USER_CONFIG_DIR,
      "cache",
      "marketplaces",
      FRAMEWORK_MARKETPLACE_NAME,
      "source"
    );
    const plugins = join(USER_CONFIG_DIR, "cache", "plugin-cache", "source");
    fs.setFile(fetched, "framework clone");
    fs.setFile(plugins, "plugin clone");
    const activator = new FakeHostActions({ available: true });
    const useCase = userScopeCleaner({
      tools: hostCatalog(),
      fs,
      repo,
      activators: new Map([[HOST.claude, activator]]),
      sources: provenClaudeSources(HOST),
      pluginRegistries: provenHostPlugins(HOST, records),
    });

    await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
      saying(/user-scope plugin files.*active projects.*\/project-b/)
    );

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(fs.getFile(sourceMarker)).toBe("source");
    expect(fs.getFile(cacheMarker)).toBe("{}");
    expect(fs.getFile(fetched)).toBe("framework clone");
    expect(fs.getFile(plugins)).toBe("plugin clone");
    expect(repo.records.get(HOST.claude)?.pluginClaims).toEqual([
      { ref: "aidd-context@aidd-framework", dependents: ["/project-b"] },
    ]);
  });

  it("refuses an owned catalogue with a foreign enabled plugin ref before any global clean effect", async () => {
    const { manifest: machine, records } = manifestWithClaude(HOST);
    const repo = new InMemoryManifestRepository(machine, undefined, records);
    const fs = new RecordingFileAdapter();
    const foreignCache = join(CLAUDE_CACHE, "aidd-framework", "foreign-payload", "bytes");
    fs.setFile(foreignCache, "foreign bytes");
    const activator = new RecordingActivator([]);
    const hostPlugins = new FakeHostPluginRegistry({
      location: "installed_plugins.json",
      refs: new Map([
        ["aidd-context@aidd-framework", { enabled: true }],
        ["foreign@aidd-framework", { enabled: true }],
      ]),
    });
    const useCase = userScopeCleaner({
      tools: hostCatalog(),
      fs,
      repo,
      activators: new Map([[HOST.claude, activator]]),
      sources: provenClaudeSources(HOST),
      pluginRegistries: new Map([[HOST.claude, hostPlugins]]),
    });
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(
      /foreign.*ref.*foreign@aidd-framework/
    );
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(await fs.readFile(foreignCache)).toBe("foreign bytes");
    expect(repo.records.get(HOST.claude)?.pluginClaims).toHaveLength(1);
  });
});
