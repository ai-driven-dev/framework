import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import type { ToolId } from "../../../src/shared/domain/tool.js";
import { FakeHostMarketplaceRegistry } from "../../contexts/host-registration/testing/fake-host-marketplace-registry.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { saying } from "../../shared/testing/saying.builder.js";
import {
  manifestWithClaude,
  provenClaudeSources,
  provenHostPlugins,
  RecordingActivator,
  RecordingFileAdapter,
  StrictListingFileAdapter,
  seedClaudeCache,
  USER_CONFIG_DIR,
} from "../testing/clean-user-scope.builder.js";
import { userScopeCleaner } from "../testing/user-scope-cleaner.builder.js";

describe("clean --scope user: report", () => {
  describe("no user manifest, machine state from a project-scope setup", () => {
    it("still purges the whitelist and touches no host, naming the referencing projects", async () => {
      const order: string[] = [];
      const fs = new RecordingFileAdapter(order);
      fs.setFile(
        join(USER_CONFIG_DIR, "cache", "built", "1.0.0", "aidd-framework", "claude", "x"),
        "1"
      );
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
      const userSourceReferences = new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR);
      await userSourceReferences.addReference("1.0.0", "/project-a");
      fs.setFile("/project-a/marker", "");
      const activator = new RecordingActivator(order);
      const logger = new CapturingLogger();
      const useCase = userScopeCleaner({
        fs,
        repo: new InMemoryManifestRepository(null),
        logger,
        marketplaceRegistry: registry,
        activators: new Map([[TOOL.claude, activator]]),
        userSourceReferences,
      });

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        saying(/the shared framework source.*active projects.*\/project-a/)
      );
      expect(fs.order).not.toContain(`deleteDirectory:${join(USER_CONFIG_DIR, "cache", "built")}`);
      // No manifest means no `nativeRegistrations` to drive a host's own CLI through -
      // the activator that would have recorded a real call never sees one.
      expect(activator.removedMarketplaces).toEqual([]);
      expect(activator.uninstalledPlugins).toEqual([]);
      const info = logger.infoMessages.find((m) => m.includes("No host registration"));
      expect(info).toBeDefined();
      expect(info).toContain("/project-a");
      // Both removal commands, in order: `aidd clean --scope user` also satisfies a bare
      // `.toContain("aidd clean")`, so the per-project half needs its own assertion.
      expect(info).toContain("`aidd clean`");
      expect(info).toContain("`aidd clean --scope user`");
      expect(info?.indexOf("`aidd clean`")).toBeLessThan(
        info?.indexOf("`aidd clean --scope user`") ?? -1
      );
    });
  });

  describe("order", () => {
    it("unregisters the marketplace through the host CLI before purging its cache", async () => {
      const order: string[] = [];
      const fs = new RecordingFileAdapter(order);
      seedClaudeCache(fs);
      const activator = new RecordingActivator(order);
      const manifestRepo = new InMemoryManifestRepository(manifestWithClaude());
      const useCase = userScopeCleaner({
        fs,
        repo: manifestRepo,
        activators: new Map([[TOOL.claude, activator]]),
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

      await useCase.execute({
        projectRoot: "/wherever",
        force: true,
      });

      const removeIndex = order.indexOf("removeMarketplace:aidd-framework");
      const purgeIndex = order.findIndex((entry) => entry.startsWith("deleteDirectory:"));
      expect(removeIndex).toBeGreaterThanOrEqual(0);
      expect(purgeIndex).toBeGreaterThanOrEqual(0);
      expect(removeIndex).toBeLessThan(purgeIndex);
    });
  });

  describe("the versions built on this machine", () => {
    function buildPreviewUseCase(fs: InMemoryFileAdapter) {
      return userScopeCleaner({ fs, repo: new InMemoryManifestRepository(Manifest.create()) });
    }

    it("lists them sorted, whatever order the cache holds them in", async () => {
      const fs = new InMemoryFileAdapter();
      fs.setFile(join(USER_CONFIG_DIR, "cache", "built", "2.0.0", "aidd-framework", "x"), "1");
      fs.setFile(join(USER_CONFIG_DIR, "cache", "built", "1.0.0", "aidd-framework", "x"), "1");

      const result = await buildPreviewUseCase(fs).execute({
        projectRoot: "/wherever",
        force: false,
      });

      expect(result.preview.builtVersions).toStrictEqual(["1.0.0", "2.0.0"]);
    });

    it("lists none when the built cache root does not exist", async () => {
      const fs = new StrictListingFileAdapter();

      const result = await buildPreviewUseCase(fs).execute({
        projectRoot: "/wherever",
        force: false,
      });

      expect(result.preview.builtVersions).toStrictEqual([]);
    });

    it("propagates a built cache root that exists but cannot be read", async () => {
      const fs = new StrictListingFileAdapter(join(USER_CONFIG_DIR, "cache", "built"));

      await expect(
        buildPreviewUseCase(fs).execute({
          projectRoot: "/wherever",
          force: false,
        })
      ).rejects.toThrow("permission denied");
    });
  });

  describe("what an absent binary is said to leave standing", () => {
    function seedRegistrations(
      toolId: ToolId,
      marketplaces: ReadonlyArray<{ alias: string; hostName: string }>,
      pluginRefs: readonly string[]
    ): Manifest {
      const manifest = Manifest.create();
      manifest.addTool(toolId, "1.0.0", []);
      manifest.setNativeRegistrations(toolId, {
        binary: toolId,
        marketplaces: [...marketplaces],
        pluginRefs: [...pluginRefs],
        pluginClaims: pluginRefs.map((ref) => ({ ref, dependents: [] })),
      });
      return manifest;
    }

    async function errorsFor(manifest: Manifest): Promise<readonly string[]> {
      const logger = new CapturingLogger();
      const useCase = userScopeCleaner({ repo: new InMemoryManifestRepository(manifest), logger });
      try {
        await useCase.execute({
          projectRoot: "/wherever",
          force: true,
        });
        throw new Error("expected a fail-closed binary refusal");
      } catch (error) {
        return [error instanceof Error ? error.message : String(error)];
      }
    }

    it("names no cache for a host whose profile declares no cache directory (copilot)", async () => {
      const warnings = await errorsFor(
        seedRegistrations(
          TOOL.copilot,
          [{ alias: "aidd-framework", hostName: "aidd-framework" }],
          ["aidd-context@aidd-framework"]
        )
      );

      expect(warnings).toStrictEqual([
        "copilot: registration left in place, the copilot CLI is not on the PATH. It would have unregistered 1 marketplace(s) and 1 plugin ref(s). User clean refused; canonical claims retained.",
      ]);
    });

    it("names no cache for a tool that drives no native CLI (cursor)", async () => {
      const warnings = await errorsFor(
        seedRegistrations(
          TOOL.cursor,
          [{ alias: "aidd-framework", hostName: "aidd-framework" }],
          []
        )
      );

      expect(warnings).toStrictEqual([
        "cursor: registration left in place, the cursor CLI is not on the PATH. It would have unregistered 1 marketplace(s) and 0 plugin ref(s). User clean refused; canonical claims retained.",
      ]);
    });

    it("names no cache when the binary registered no marketplace", async () => {
      const warnings = await errorsFor(
        seedRegistrations(TOOL.codex, [], ["aidd-context@aidd-framework"])
      );

      expect(warnings).toStrictEqual([
        "codex: registration left in place, the codex CLI is not on the PATH. It would have unregistered 0 marketplace(s) and 1 plugin ref(s). User clean refused; canonical claims retained.",
      ]);
    });
  });

  describe("a plugin's own files", () => {
    it("leaves a project-scope plugin's files alone, this run owning no project", async () => {
      const fs = new RecordingFileAdapter();
      const projectFile = join("/wherever", "skills", "x.md");
      fs.setFile(projectFile, "x");
      const manifest = Manifest.create();
      manifest.addTool(TOOL.cursor, "1.0.0", []);
      manifest.addPlugin(
        TOOL.cursor,
        InstalledPlugin.fromMetadata({
          name: "aidd-context",
          version: "1.0.0",
          source: { kind: "local", path: "/whatever" },
          strict: false,
          scope: "project",
        }).withFiles(new Map([["skills/x.md", "hash"]]))
      );
      const useCase = userScopeCleaner({ fs, repo: new InMemoryManifestRepository(manifest) });

      await useCase.execute({
        projectRoot: "/wherever",
        force: true,
      });

      expect(fs.has(projectFile)).toBe(true);
      expect(fs.order).not.toContain(`deleteFile:${projectFile}`);
    });
  });
});
