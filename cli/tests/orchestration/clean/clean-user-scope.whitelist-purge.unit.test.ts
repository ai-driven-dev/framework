import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { saying } from "../../shared/testing/saying.builder.js";
import {
  HOME,
  RecordingFileAdapter,
  USER_CONFIG_DIR,
} from "../testing/clean-user-scope.builder.js";
import { userScopeCleaner } from "../testing/user-scope-cleaner.builder.js";

describe("clean --scope user: whitelist purge", () => {
  describe("whitelist", () => {
    it("purges fetched framework and plugin caches while preserving another marketplace's source", async () => {
      const fs = new RecordingFileAdapter();
      const framework = join(USER_CONFIG_DIR, "cache", "marketplaces", FRAMEWORK_MARKETPLACE_NAME);
      const plugins = join(USER_CONFIG_DIR, "cache", "plugin-cache");
      const other = join(USER_CONFIG_DIR, "cache", "marketplaces", "other-marketplace", "source");
      fs.setFile(join(framework, "source"), "framework clone");
      fs.setFile(join(plugins, "source"), "plugin clone");
      fs.setFile(other, "another marketplace's clone");
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        "/wherever",
        Marketplace.create({
          name: "other-marketplace",
          source: { kind: "local", path: other },
          scope: "user",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      const useCase = userScopeCleaner({
        fs,
        repo: new InMemoryManifestRepository(Manifest.create()),
        marketplaceRegistry: registry,
      });

      await useCase.execute({
        projectRoot: "/wherever",
        force: true,
      });

      expect(await fs.fileExists(framework)).toBe(false);
      expect(await fs.fileExists(plugins)).toBe(false);
      expect(fs.getFile(other)).toBe("another marketplace's clone");
      expect(registry.getAll("/wherever").map((marketplace) => marketplace.name)).toEqual([
        "other-marketplace",
      ]);
    });

    it("removes the cache shell once the fetched framework and plugin caches are gone", async () => {
      const fs = new RecordingFileAdapter();
      fs.setFile(
        join(USER_CONFIG_DIR, "cache", "marketplaces", FRAMEWORK_MARKETPLACE_NAME, "source"),
        "framework clone"
      );
      fs.setFile(join(USER_CONFIG_DIR, "cache", "plugin-cache", "source"), "plugin clone");
      const useCase = userScopeCleaner({
        fs,
        repo: new InMemoryManifestRepository(Manifest.create()),
      });

      await useCase.execute({
        projectRoot: "/wherever",
        force: true,
      });

      expect(await fs.fileExists(join(USER_CONFIG_DIR, "cache"))).toBe(false);
      expect(fs.order).toContain(
        `deleteDirectory:${join(USER_CONFIG_DIR, "cache", "marketplaces")}`
      );
      expect(fs.order).toContain(`deleteDirectory:${join(USER_CONFIG_DIR, "cache")}`);
    });

    it.each(["cache/marketplaces/aidd-framework", "cache/plugin-cache"])(
      "preserves a fetched source resolving outside user config through %s",
      async (relativePath) => {
        const fs = new RecordingFileAdapter([], ["/elsewhere/clone"]);
        const cache = join(USER_CONFIG_DIR, relativePath);
        const marker = join(cache, "source");
        fs.setFile(marker, "external clone");
        fs.setSymlink(cache, "/elsewhere/clone");
        const logger = new CapturingLogger();
        const useCase = userScopeCleaner({
          fs,
          repo: new InMemoryManifestRepository(Manifest.create()),
          logger,
        });

        await useCase.execute({
          projectRoot: "/wherever",
          force: true,
        });

        expect(fs.getFile(marker)).toBe("external clone");
        expect(fs.order).not.toContain(`deleteDirectory:${cache}`);
        expect(logger.warnMessages).toContain(
          `user scope: ${relativePath} does not resolve inside ${USER_CONFIG_DIR}; left in place: ${cache}`
        );
      }
    );

    it("removes framework state and keeps other marketplace registrations", async () => {
      const fs = new RecordingFileAdapter();
      fs.setFile(
        join(USER_CONFIG_DIR, "cache", "built", "1.0.0", "aidd-framework", "claude", "x"),
        "1"
      );
      const manifestRepo = new InMemoryManifestRepository(Manifest.create());
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        "/wherever",
        Marketplace.create({
          name: FRAMEWORK_MARKETPLACE_NAME,
          source: { kind: "local", path: "/src/framework" },
          scope: "user",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      await registry.save(
        "/wherever",
        Marketplace.create({
          name: "other-marketplace",
          source: { kind: "local", path: "/src/other" },
          scope: "user",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      const userSourceReferences = new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR);
      await userSourceReferences.addReference("1.0.0", "/project-a");
      await userSourceReferences.removeReference("/project-a");
      const useCase = userScopeCleaner({
        fs,
        repo: manifestRepo,
        marketplaceRegistry: registry,
        userSourceReferences,
      });

      await useCase.execute({
        projectRoot: "/wherever",
        force: true,
      });

      expect(fs.order).toContain(`deleteDirectory:${join(USER_CONFIG_DIR, "cache", "built")}`);
      expect(fs.order).toContain(`deleteFile:${join(USER_CONFIG_DIR, "references.json")}`);
      expect(manifestRepo.getCurrent()).toBeNull();
      const remaining = registry.getAll("/wherever").map((m) => m.name);
      expect(remaining).not.toContain(FRAMEWORK_MARKETPLACE_NAME);
      expect(remaining).toContain("other-marketplace");
    });

    it("deletes the update-check cache too, so nothing is left to keep the cache/ shell alive", async () => {
      const fs = new RecordingFileAdapter();
      fs.setFile(
        join(USER_CONFIG_DIR, "cache", "built", "1.0.0", "aidd-framework", "claude", "x"),
        "1"
      );
      // Written by any online command into the same `cache/` directory `cache/built/` sits
      // in - the occupant that used to survive a machine-scope clean and keep the shell alive.
      fs.setFile(join(USER_CONFIG_DIR, "cache", "update-check.json"), '{"latest":"9.9.9"}');
      // And where an older CLI wrote the same cache, before it moved under `cache/`.
      fs.setFile(join(USER_CONFIG_DIR, "update-check.json"), '{"latest":"8.0.0"}');
      const useCase = userScopeCleaner({
        fs,
        repo: new InMemoryManifestRepository(Manifest.create()),
      });

      await useCase.execute({
        projectRoot: "/wherever",
        force: true,
      });

      expect(fs.order).toContain(
        `deleteFile:${join(USER_CONFIG_DIR, "cache", "update-check.json")}`
      );
      expect(await fs.fileExists(join(USER_CONFIG_DIR, "cache", "update-check.json"))).toBe(false);
      expect(fs.order).toContain(`deleteFile:${join(USER_CONFIG_DIR, "update-check.json")}`);
      // Nothing else sat beside it, so the shell itself goes with it.
      expect(fs.order).toContain(`deleteDirectory:${join(USER_CONFIG_DIR, "cache")}`);
    });

    it("never deletes userConfigDir() itself, even when references.json resolves back to it through a symlink", async () => {
      const fs = new RecordingFileAdapter();
      fs.setFile(join(USER_CONFIG_DIR, "marker"), "1");
      // A corrupted or attacker-controlled state: the references file has become a
      // symlink pointing straight back at userConfigDir() itself.
      fs.setSymlink(join(USER_CONFIG_DIR, "references.json"), USER_CONFIG_DIR);
      const logger = new CapturingLogger();
      const useCase = userScopeCleaner({
        fs,
        repo: new InMemoryManifestRepository(Manifest.create()),
        logger,
      });

      await useCase.execute({
        projectRoot: "/wherever",
        force: true,
      });

      // references.json's own candidate resolves straight back to userConfigDir() itself,
      // which containment refuses regardless of equality.
      expect(fs.order).not.toContain(`deleteFile:${join(USER_CONFIG_DIR, "references.json")}`);
      expect(fs.order).not.toContain(`deleteFile:${USER_CONFIG_DIR}`);
      expect(fs.order.some((entry) => entry.endsWith(USER_CONFIG_DIR))).toBe(false);
      // userConfigDir() itself must still exist - the marker file placed directly under it
      // proves the directory was never recursively removed.
      expect(await fs.fileExists(join(USER_CONFIG_DIR, "marker"))).toBe(true);
    });

    it("leaves a cursor plugin file in place when it resolves outside the user plugins boundary through a symlink", async () => {
      const fs = new RecordingFileAdapter([], [join(HOME, ".cursor", "plugins", "local")]);
      const boundary = join(HOME, ".cursor", "plugins", "local");
      // A sibling sharing `boundary`'s name as a string prefix, not a path under it: a raw
      // `startsWith` would call it contained, where `relative()` sees the leading `..`.
      const escapeTarget = `${boundary}-evil`;
      fs.setFile(join(escapeTarget, "evil.md"), "danger");
      // The manifest's own entry names a plugin directory that, since install, became a
      // symlink escaping the declared user-scope boundary.
      fs.setSymlink(join(boundary, "rogue-plugin"), escapeTarget);
      const manifest = Manifest.create();
      manifest.addTool(TOOL.cursor, "1.0.0", []);
      manifest.addPlugin(
        TOOL.cursor,
        InstalledPlugin.fromMetadata({
          name: "rogue-plugin",
          version: "1.0.0",
          source: { kind: "local", path: "/whatever" },
          strict: false,
          scope: "user",
        }).withFiles(new Map([["rogue-plugin/evil.md", "hash"]]))
      );
      const logger = new CapturingLogger();
      const useCase = userScopeCleaner({
        fs,
        repo: new InMemoryManifestRepository(manifest),
        logger,
      });

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        /tracked file.*escaped/
      );

      expect(await fs.fileExists(join(escapeTarget, "evil.md"))).toBe(true);
      expect(logger.warnMessages.some((m) => m.includes("does not resolve inside"))).toBe(true);
    });
  });

  describe("confirmation", () => {
    it("names the versions built and the projects still referencing the source", async () => {
      const fs = new InMemoryFileAdapter();
      fs.setFile(
        join(USER_CONFIG_DIR, "cache", "built", "1.2.3", "aidd-framework", "claude", "x"),
        "1"
      );
      fs.setFile("/project-a/marker", "");
      const userSourceReferences = new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR);
      await userSourceReferences.addReference("1.2.3", "/project-a");
      const useCase = userScopeCleaner({
        fs,
        repo: new InMemoryManifestRepository(Manifest.create()),
        userSourceReferences,
      });

      const result = await useCase.execute({
        projectRoot: "/wherever",
        force: false,
      });

      expect(result.dryRun).toBe(true);
      expect(result.preview.builtVersions).toEqual(["1.2.3"]);
      expect(result.preview.referencingProjects).toEqual(["/project-a"]);
    });

    it("ignores a referencing project whose own path no longer exists", async () => {
      const fs = new InMemoryFileAdapter();
      const userSourceReferences = new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR);
      await userSourceReferences.addReference("1.0.0", "/gone");
      const useCase = userScopeCleaner({
        fs,
        repo: new InMemoryManifestRepository(Manifest.create()),
        userSourceReferences,
      });

      const result = await useCase.execute({
        projectRoot: "/wherever",
        force: false,
      });

      expect(result.preview.referencingProjects).toEqual([]);
    });

    it("--force cannot remove a shared source still referenced by a project", async () => {
      const fs = new InMemoryFileAdapter();
      fs.setFile("/project-a/marker", "");
      const userSourceReferences = new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR);
      await userSourceReferences.addReference("1.0.0", "/project-a");
      const manifestRepo = new InMemoryManifestRepository(Manifest.create());
      const useCase = userScopeCleaner({ fs, repo: manifestRepo, userSourceReferences });

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        saying(/active projects.*\/project-a/)
      );
      expect(manifestRepo.getCurrent()).not.toBeNull();
    });
  });
});
