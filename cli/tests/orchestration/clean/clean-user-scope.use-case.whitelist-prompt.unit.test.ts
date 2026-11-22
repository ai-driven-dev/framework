import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { RecordingPrompter } from "../../shared/testing/recording-prompter.fake.js";
import { syntheticCatalog } from "../../shared/testing/synthetic-tool-id.builder.js";
import {
  RecordingFileAdapter,
  StrictListingFileAdapter,
  seedWhitelist,
  USER_CONFIG_DIR,
  WHITELIST_PURGE_MESSAGES,
} from "../testing/clean-user-scope.builder.js";
import { userScopeCleaner } from "../testing/user-scope-cleaner.builder.js";

describe("clean --scope user: whitelist prompt and cache shell", () => {
  describe("confirmation prompt", () => {
    it("proceeds and purges once the interactive prompt is answered yes, pinning its wording", async () => {
      const fs = new RecordingFileAdapter();
      const manifestRepo = new InMemoryManifestRepository(Manifest.create());
      const prompter = new RecordingPrompter(true);
      const useCase = userScopeCleaner({
        tools: syntheticCatalog(),
        fs,
        repo: manifestRepo,
        prompter,
      });

      const result = await useCase.execute({
        projectRoot: "/wherever",
        force: false,
        interactive: true,
      });

      expect(prompter.lastConfirmMessage).toBe(
        "Remove the shared 'aidd-framework' source for this machine " +
          "(versions: none built yet)? Still referenced by: no other project."
      );
      expect(result.dryRun).toBe(false);
      expect(manifestRepo.getCurrent()).toBeNull();
    });

    it("does nothing once the interactive prompt is answered no", async () => {
      const fs = new RecordingFileAdapter();
      const manifestRepo = new InMemoryManifestRepository(Manifest.create());
      const prompter = new RecordingPrompter(false);
      const useCase = userScopeCleaner({
        tools: syntheticCatalog(),
        fs,
        repo: manifestRepo,
        prompter,
      });

      const result = await useCase.execute({
        projectRoot: "/wherever",
        force: false,
        interactive: true,
      });

      expect(result.dryRun).toBe(true);
      expect(manifestRepo.getCurrent()).not.toBeNull();
      expect(fs.order).toEqual([]);
    });

    it("never asks outside an interactive run, even with a prompter wired in", async () => {
      const fs = new RecordingFileAdapter();
      const prompter = new RecordingPrompter(true);
      const useCase = userScopeCleaner({
        tools: syntheticCatalog(),
        fs,
        repo: new InMemoryManifestRepository(Manifest.create()),
        prompter,
      });

      const result = await useCase.execute({
        projectRoot: "/wherever",
        force: false,
      });

      expect(prompter.confirmMessages).toStrictEqual([]);
      expect(result.dryRun).toBe(true);
      expect(fs.order).toStrictEqual([]);
    });

    it("names every built version and every referencing project in its question", async () => {
      const fs = new InMemoryFileAdapter();
      fs.setFile(join(USER_CONFIG_DIR, "cache", "built", "2.0.0", "aidd-framework", "x"), "1");
      fs.setFile(join(USER_CONFIG_DIR, "cache", "built", "1.2.3", "aidd-framework", "x"), "1");
      fs.setFile("/project-a/marker", "");
      fs.setFile("/project-b/marker", "");
      const userSourceReferences = new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR);
      await userSourceReferences.addReference("1.2.3", "/project-a");
      await userSourceReferences.addReference("2.0.0", "/project-b");
      const prompter = new RecordingPrompter(false);
      const useCase = userScopeCleaner({
        tools: syntheticCatalog(),
        fs,
        repo: new InMemoryManifestRepository(Manifest.create()),
        userSourceReferences,
        prompter,
      });

      await useCase.execute({
        projectRoot: "/wherever",
        force: false,
        interactive: true,
      });

      expect(prompter.confirmMessages).toStrictEqual([
        "Remove the shared 'aidd-framework' source for this machine " +
          "(versions: 1.2.3, 2.0.0)? Still referenced by: /project-a, /project-b.",
      ]);
    });
  });

  describe("the cache/ shell around the whitelist", () => {
    it("tolerates a cache shell already absent while still removing later whitelist files", async () => {
      const fs = new StrictListingFileAdapter();
      const marker = join(USER_CONFIG_DIR, "update-check.json");
      fs.setFile(marker, "legacy cache");
      const logger = new CapturingLogger();
      const repo = new InMemoryManifestRepository(Manifest.create());
      const useCase = userScopeCleaner({ tools: syntheticCatalog(), fs, repo, logger });

      const result = await useCase.execute({
        projectRoot: "/wherever",
        force: true,
      });

      expect(result.dryRun).toBe(false);
      expect(fs.has(marker)).toBe(false);
      expect(repo.getCurrent()).toBeNull();
      expect(logger.infoMessages).not.toContain(
        `user scope: cache purged: ${join(USER_CONFIG_DIR, "cache")}`
      );
    });

    it("propagates an unreadable cache shell and retains canonical state and later whitelist files", async () => {
      const fs = new StrictListingFileAdapter(join(USER_CONFIG_DIR, "cache"));
      const source = join(USER_CONFIG_DIR, "cache", "built", "1.0.0", "catalogue.json");
      const legacy = join(USER_CONFIG_DIR, "update-check.json");
      fs.setFile(source, "built source");
      fs.setFile(legacy, "legacy cache");
      const machine = Manifest.create();
      const repo = new InMemoryManifestRepository(machine);
      const useCase = userScopeCleaner({ tools: syntheticCatalog(), fs, repo });

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        "permission denied"
      );

      expect(fs.has(source)).toBe(false);
      expect(fs.getFile(legacy)).toBe("legacy cache");
      expect(repo.getCurrent()).toBe(machine);
    });

    it("leaves cache/ and everything under it in place, naming each, once cache/ resolves outside userConfigDir()", async () => {
      const fs = new RecordingFileAdapter([], [USER_CONFIG_DIR]);
      const cacheDir = join(USER_CONFIG_DIR, "cache");
      await seedWhitelist(fs, "/elsewhere");
      fs.setSymlink(cacheDir, "/elsewhere/cache");
      const logger = new CapturingLogger();
      const useCase = userScopeCleaner({
        tools: syntheticCatalog(),
        fs,
        repo: new InMemoryManifestRepository(Manifest.create()),
        logger,
      });

      await useCase.execute({
        projectRoot: "/wherever",
        force: true,
      });

      expect(fs.has("/elsewhere/cache/update-check.json")).toBe(true);
      expect(logger.warnMessages).toStrictEqual([
        `user scope: cache/built does not resolve inside ${USER_CONFIG_DIR}; left in place: ${join(cacheDir, "built")}`,
        `user scope: cache/marketplaces/aidd-framework does not resolve inside ${USER_CONFIG_DIR}; left in place: ${join(cacheDir, "marketplaces", FRAMEWORK_MARKETPLACE_NAME)}`,
        `user scope: cache/plugin-cache does not resolve inside ${USER_CONFIG_DIR}; left in place: ${join(cacheDir, "plugin-cache")}`,
        `user scope: cache/marketplaces does not resolve inside ${USER_CONFIG_DIR}; left in place: ${join(cacheDir, "marketplaces")}`,
        `user scope: cache/update-check.json does not resolve inside ${USER_CONFIG_DIR}; left in place: ${join(cacheDir, "update-check.json")}`,
        `user scope: cache does not resolve inside ${USER_CONFIG_DIR}; left in place: ${cacheDir}`,
      ]);
    });

    it("keeps the shell while something this whitelist never named still lives in it", async () => {
      const fs = new RecordingFileAdapter();
      const other = join(USER_CONFIG_DIR, "cache", "other.json");
      fs.setFile(other, "{}");
      await seedWhitelist(fs);
      const logger = new CapturingLogger();
      const useCase = userScopeCleaner({
        tools: syntheticCatalog(),
        fs,
        repo: new InMemoryManifestRepository(Manifest.create()),
        logger,
      });

      await useCase.execute({
        projectRoot: "/wherever",
        force: true,
      });

      expect(fs.has(other)).toBe(true);
      expect(logger.infoMessages).toStrictEqual(
        WHITELIST_PURGE_MESSAGES.filter((m) => !m.startsWith("user scope: cache purged"))
      );
    });
  });
});
