import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import { FakeHostMarketplaceRegistry } from "../../contexts/host-registration/testing/fake-host-marketplace-registry.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { saying } from "../../shared/testing/saying.builder.js";
import {
  CLAUDE_CACHE,
  manifestWithClaude,
  provenClaudeSources,
  provenHostPlugins,
  seedClaudeCache,
  seedWhitelist,
  USER_CONFIG_DIR,
  WHITELIST_PURGE_MESSAGES,
} from "../testing/clean-user-scope.builder.js";
import { userScopeCleaner } from "../testing/user-scope-cleaner.builder.js";

describe("clean --scope user: host report", () => {
  describe("what the run reports", () => {
    function buildClaudeUseCase(fs: InMemoryFileAdapter, logger: CapturingLogger) {
      return userScopeCleaner({
        fs,
        repo: new InMemoryManifestRepository(manifestWithClaude()),
        logger,
        activators: new Map([[TOOL.claude, new FakeHostActions({ available: true })]]),
        marketplaceRegistries: new Map([
          [
            TOOL.claude,
            new FakeHostMarketplaceRegistry({
              location: "known_marketplaces.json",
              entries: new Map(),
            }),
          ],
        ]),
        sources: provenClaudeSources(),
        pluginRegistries: provenHostPlugins(manifestWithClaude()),
      });
    }

    it("reports the manifest found and the tools it named, and purges the cache the host forgot", async () => {
      const fs = new InMemoryFileAdapter();
      const claudeCachePath = seedClaudeCache(fs);
      const useCase = buildClaudeUseCase(fs, new CapturingLogger());

      const result = await useCase.execute({
        projectRoot: "/wherever",
        force: true,
      });

      expect(result).toStrictEqual({
        dryRun: false,
        manifestFound: true,
        preview: {
          toolIds: ["claude"],
          activePluginDependents: [],
          builtVersions: [],
          referencingProjects: [],
        },
      });
      expect(await fs.fileExists(join(claudeCachePath, "marker.json"))).toBe(false);
    });

    it("names each purge, by its label and path, and nothing about a missing user registration", async () => {
      const fs = new InMemoryFileAdapter();
      seedClaudeCache(fs);
      await seedWhitelist(fs);
      const logger = new CapturingLogger();
      const useCase = buildClaudeUseCase(fs, logger);

      await useCase.execute({
        projectRoot: "/wherever",
        force: true,
      });

      expect(logger.infoMessages).toStrictEqual([
        `claude: cache for 'aidd-framework' purged: ${join(CLAUDE_CACHE, "aidd-framework")}`,
        ...WHITELIST_PURGE_MESSAGES,
      ]);
    });

    it("reports no tool, and says plainly that nothing was registered, when no user manifest exists", async () => {
      const fs = new InMemoryFileAdapter();
      await seedWhitelist(fs);
      const logger = new CapturingLogger();
      const useCase = userScopeCleaner({ fs, repo: new InMemoryManifestRepository(null), logger });

      const result = await useCase.execute({
        projectRoot: "/wherever",
        force: true,
      });

      expect(result).toStrictEqual({
        dryRun: false,
        manifestFound: false,
        preview: {
          toolIds: [],
          activePluginDependents: [],
          builtVersions: [],
          referencingProjects: [],
        },
      });
      expect(logger.infoMessages).toStrictEqual([
        "No host registration was undone: nothing was registered at user scope.",
        ...WHITELIST_PURGE_MESSAGES,
      ]);
    });

    it("names every referencing project, comma separated, when nothing was registered here", async () => {
      const fs = new InMemoryFileAdapter();
      fs.setFile("/project-a/marker", "");
      fs.setFile("/project-b/marker", "");
      const userSourceReferences = new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR);
      await userSourceReferences.addReference("1.0.0", "/project-a");
      await userSourceReferences.addReference("1.0.0", "/project-b");
      const logger = new CapturingLogger();
      const useCase = userScopeCleaner({
        fs,
        repo: new InMemoryManifestRepository(null),
        logger,
        userSourceReferences,
      });

      await useCase.execute({
        projectRoot: "/wherever",
        force: false,
      });

      expect(logger.infoMessages).toStrictEqual([
        "No host registration was undone: nothing was registered at user scope. " +
          "/project-a, /project-b still resolve the shared source through their own host; " +
          "full removal is `aidd clean` in each of them, then `aidd clean --scope user`.",
      ]);
    });

    it("refuses to interpret an unreadable references.json as no dependent project", async () => {
      const fs = new InMemoryFileAdapter();
      fs.setFile(join(USER_CONFIG_DIR, "references.json"), "not json");
      const logger = new CapturingLogger();
      const useCase = userScopeCleaner({
        fs,
        repo: new InMemoryManifestRepository(Manifest.create()),
        logger,
        userSourceReferences: new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR),
      });

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        saying(/Cannot read.*references.json/)
      );
      expect(await fs.fileExists(join(USER_CONFIG_DIR, "references.json"))).toBe(true);
    });
  });
});
