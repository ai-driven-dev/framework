import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import { FakeHostPluginRegistry } from "../../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { hostRecord } from "../../shared/testing/host-record-reading.builder.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  AT_PROJECT,
  BINARY,
  CleanWithKnownHostSource,
  MARKETPLACE,
  PROJECT_ROOT,
  REF,
  seedClaudeNativeRegistrations,
  seedManifestWithNativeRegistrations,
  seedMarketplaceRegistry,
} from "../testing/clean-project.builder.js";
import { userScopeCleaner } from "../testing/user-scope-cleaner.builder.js";

describe("clean: shared source", () => {
  describe("undoing a host's own native registration", () => {
    describe("machine claims survive project cleanup", () => {
      it("names shared-source dependents only on refs belonging to that source", async () => {
        const manifest = seedManifestWithNativeRegistrations();
        manifest.setNativeRegistrations(TOOL.codex, {
          binary: BINARY,
          marketplaces: [
            ...(hostRecord(manifest.getNativeRegistrations(TOOL.codex))?.marketplaces ?? []),
            {
              alias: "other",
              hostName: "other-host",
              provenance: {
                kind: "effective-list",
                root: "/some/built/path",
                sourceType: "local",
                source: "/some/built/path",
              },
            },
          ],
          pluginRefs: [REF, "unclaimed@other-host"],
        });
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const roots = [PROJECT_ROOT, "/project-b", "/project-c"];
        for (const root of roots) fs.setFile(join(root, "marker"), "project");
        const references = new UserSourceReferencesAdapter(fs, () => "/fake-home/.config/aidd");
        for (const root of roots) await references.addReference("1.0.0", root);
        const registry = new InMemoryMarketplaceRegistry();
        await registry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name: MARKETPLACE,
            source: { kind: "local", path: "/some/built/path" },
            scope: "user",
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
        await registry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name: "other",
            source: { kind: "local", path: "/some/built/path" },
            scope: "project",
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
        const activator = new FakeHostActions({ available: true });
        const logger = new CapturingLogger();
        const useCase = new CleanWithKnownHostSource(
          fs,
          new InMemoryManifestRepository(manifest, PROJECT_ROOT),
          logger,
          new UpdateGitignore(fs),
          new Map([[BINARY, activator]]),
          registry,
          undefined,
          new Map(),
          () => "/fake-home",
          references,
          undefined,
          new InMemoryManifestRepository(Manifest.create(), "/fake-home")
        );

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(activator.uninstalledPlugins).toEqual([]);
        expect(activator.removedMarketplaces).toEqual(["other-host"]);
        expect(await references.listAllReferencingProjects()).toEqual(["/project-b", "/project-c"]);
        expect(logger.warnMessages.slice(0, 2)).toEqual([
          `codex: '${REF}' has no canonical machine claim — left enabled for manual reconciliation; project claim detached after local clean. Still needed by /project-b, /project-c.`,
          "codex: 'unclaimed@other-host' has no canonical machine claim — left enabled for manual reconciliation; project claim detached after local clean.",
        ]);
      });

      it("keeps canonical refs and reports remaining dependents", async () => {
        const others = ["/project-b", "/project-c"];
        const suffix = " Still needed by /project-b, /project-c.";
        const manifest = seedManifestWithNativeRegistrations();
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        fs.setFile(join(PROJECT_ROOT, "marker"), "project");
        const cachePath = "/fake-home/.codex/plugins/cache/aidd-framework/plugin.json";
        fs.setFile(cachePath, "cache");
        const extraRef = "another@aidd-framework";
        const machine = Manifest.create();
        machine.addTool(TOOL.codex, "1.0.0", []);
        machine.setNativeRegistrations(TOOL.codex, {
          binary: BINARY,
          marketplaces: manifest.getNativeRegistrations(TOOL.codex)?.marketplaces ?? [],
          pluginRefs: [REF, extraRef],
          pluginClaims: [
            { ref: REF, dependents: [PROJECT_ROOT, ...others] },
            { ref: extraRef, dependents: [PROJECT_ROOT, ...others] },
            { ref: "unrelated@other-host", dependents: ["/unrelated"] },
          ],
        });
        const machineRepo = new InMemoryManifestRepository(machine, "/fake-home");
        const projectRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
        const activator = new FakeHostActions({ available: true });
        const logger = new CapturingLogger();
        const hostRefs = new FakeHostPluginRegistry({
          location: "Codex machine refs",
          refs: new Map([
            [REF, { enabled: true }],
            [extraRef, { enabled: true }],
          ]),
        });
        const useCase = new CleanWithKnownHostSource(
          fs,
          projectRepo,
          logger,
          new UpdateGitignore(fs),
          new Map([[BINARY, activator]]),
          seedMarketplaceRegistry(),
          undefined,
          new Map(),
          () => "/fake-home",
          undefined,
          new Map([[TOOL.codex, hostRefs]]),
          machineRepo
        );

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(activator.uninstalledPlugins).toEqual([]);
        expect(activator.removedMarketplaces).toEqual([]);
        expect(fs.getFile(cachePath)).toBe("cache");
        expect(projectRepo.getCurrent()).toBeNull();
        expect(machineRepo.getCurrent()?.getNativeRegistrations(TOOL.codex)?.pluginClaims).toEqual([
          { ref: REF, dependents: others },
          { ref: extraRef, dependents: [PROJECT_ROOT, ...others] },
          { ref: "unrelated@other-host", dependents: ["/unrelated"] },
        ]);
        expect(logger.warnMessages).toEqual([
          `codex: '${REF}' is an AIDD-owned machine plugin ref — left enabled; project claim detached after local clean.${suffix}`,
          `codex: '${MARKETPLACE}' carries AIDD-owned machine plugin refs — left registered for explicit user-scope removal.${suffix}`,
          `codex: cache for '${MARKETPLACE}' left in place, its own removal was not confirmed: ${join("/fake-home", ".codex", "plugins", "cache", MARKETPLACE)}`,
        ]);
      });

      it.each([undefined, { binary: BINARY, marketplaces: [], pluginRefs: [] }])(
        "removes an empty project catalogue when the machine has no matching claims: %j",
        async (machineRegistrations) => {
          const machine = Manifest.create();
          machine.addTool(TOOL.codex, "1.0.0", []);
          if (machineRegistrations !== undefined)
            machine.setNativeRegistrations(TOOL.codex, machineRegistrations);
          const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
          const logger = new CapturingLogger();
          const activator = new FakeHostActions({ available: true });
          const useCase = new CleanWithKnownHostSource(
            fs,
            new InMemoryManifestRepository(seedManifestWithNativeRegistrations(), PROJECT_ROOT),
            logger,
            new UpdateGitignore(fs),
            new Map([[BINARY, activator]]),
            seedMarketplaceRegistry(),
            undefined,
            new Map(),
            () => "/fake-home",
            undefined,
            undefined,
            new InMemoryManifestRepository(machine, "/fake-home")
          );

          await useCase.execute({ ...AT_PROJECT, force: true });

          expect(activator.removedMarketplaces).toEqual([MARKETPLACE]);
          expect(logger.warnMessages).toEqual([
            `codex: '${REF}' has no canonical machine claim — left enabled for manual reconciliation; project claim detached after local clean.`,
          ]);
        }
      );
    });

    describe("unproven Claude refs in a shared source", () => {
      async function sharedClaudeRegistry(): Promise<InMemoryMarketplaceRegistry> {
        const registry = new InMemoryMarketplaceRegistry();
        await registry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name: MARKETPLACE,
            source: { kind: "local", path: "/some/built/path" },
            scope: "user",
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
        return registry;
      }

      it("warns about a ref whose host catalogue was not recorded", async () => {
        const manifest = seedClaudeNativeRegistrations();
        manifest.setNativeRegistrations(TOOL.claude, {
          binary: "claude",
          marketplaces: manifest.getNativeRegistrations(TOOL.claude)?.marketplaces ?? [],
          pluginRefs: ["orphan@unrecorded"],
        });
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const logger = new CapturingLogger();
        const activator = new FakeHostActions({ available: true });
        const useCase = new CleanWithKnownHostSource(
          fs,
          new InMemoryManifestRepository(manifest, PROJECT_ROOT),
          logger,
          new UpdateGitignore(fs),
          new Map([[TOOL.claude, activator]]),
          await sharedClaudeRegistry()
        );

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(activator.uninstalledPlugins).toEqual([]);
        expect(logger.warnMessages[0]).toBe(
          "claude: 'orphan@unrecorded' has no recorded host catalogue — left enabled."
        );
      });

      it.each([false, true])(
        "only uninstalls when all other host refs have canonical machine claims: %s",
        async (claimed) => {
          const extraRef = "machine-plugin@aidd-framework";
          const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
          fs.setFile(join(PROJECT_ROOT, "marker"), "project");
          const machine = Manifest.create();
          machine.addTool(TOOL.claude, "1.0.0", []);
          machine.setNativeRegistrations(TOOL.claude, {
            binary: "claude",
            marketplaces: [],
            pluginRefs: [extraRef],
            pluginClaims: claimed ? [{ ref: extraRef, dependents: ["/other-project"] }] : [],
          });
          const hostRefs = new FakeHostPluginRegistry({
            location: "Claude refs fixture",
            refs: new Map([
              [REF, { enabled: true, scope: "project" }],
              [extraRef, { enabled: true, scope: "user" }],
            ]),
          });
          const logger = new CapturingLogger();
          const activator = new FakeHostActions({ available: true });
          const useCase = new CleanWithKnownHostSource(
            fs,
            new InMemoryManifestRepository(seedClaudeNativeRegistrations(), PROJECT_ROOT),
            logger,
            new UpdateGitignore(fs),
            new Map([[TOOL.claude, activator]]),
            await sharedClaudeRegistry(),
            undefined,
            new Map(),
            () => "/fake-home",
            undefined,
            new Map([[TOOL.claude, hostRefs]]),
            new InMemoryManifestRepository(machine, "/fake-home")
          );

          await useCase.execute({ ...AT_PROJECT, force: true });

          expect(activator.uninstalledPlugins).toEqual(claimed ? [REF] : []);
          expect(activator.removedMarketplaces).toEqual([]);
          if (claimed)
            expect(
              logger.warnMessages.some((message) => message.includes("foreign host ref"))
            ).toBe(false);
          else
            expect(logger.warnMessages[0]).toBe(
              `claude: '${REF}' left enabled; Error: Catalogue '${MARKETPLACE}' includes foreign host ref '${extraRef}'; no host mutation made.`
            );
        }
      );
    });

    describe("this project's own reference to the shared source", () => {
      const OTHER_PROJECT_ROOT = "/other-project";

      function seedReferences(
        fs: InMemoryFileAdapter,
        projectRoots: readonly string[]
      ): UserSourceReferencesAdapter {
        for (const root of projectRoots) fs.setFile(join(root, "marker"), "");
        return new UserSourceReferencesAdapter(fs, () => "/fake-home/.config/aidd");
      }

      it("drops its own claim but leaves the shared marketplace registered — the other project still sees it", async () => {
        const manifest = seedManifestWithNativeRegistrations();
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
        const activator = new FakeHostActions({ available: true });
        const registry = new InMemoryMarketplaceRegistry();
        await registry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name: MARKETPLACE,
            source: { kind: "local", path: "/shared/built/path" },
            scope: "user",
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
        const userSourceReferences = seedReferences(fs, [PROJECT_ROOT, OTHER_PROJECT_ROOT]);
        await userSourceReferences.addReference("1.0.0", PROJECT_ROOT);
        await userSourceReferences.addReference("1.0.0", OTHER_PROJECT_ROOT);
        const useCase = new CleanWithKnownHostSource(
          fs,
          manifestRepo,
          new CapturingLogger(),
          new UpdateGitignore(fs),
          new Map([[BINARY, activator]]),
          registry,
          undefined,
          new Map(),
          () => "/fake-home",
          userSourceReferences
        );

        await useCase.execute({ ...AT_PROJECT, force: true });

        // The host-side guard already in place: the shared marketplace is never
        // unregistered from claude/codex/copilot by a single project's own `clean`.
        expect(activator.removedMarketplaces).toEqual([]);
        // Only this project's own claim is dropped, and the other project — reading the
        // very same registry — still finds the marketplace registered.
        expect(await userSourceReferences.listAllReferencingProjects()).toContain(
          OTHER_PROJECT_ROOT
        );
        expect((await registry.list(OTHER_PROJECT_ROOT)).map((m) => m.name)).toContain(MARKETPLACE);
      });

      it("keeps its shared source claim when gitignore cleanup fails", async () => {
        const manifest = seedManifestWithNativeRegistrations();
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const registry = new InMemoryMarketplaceRegistry();
        await registry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name: MARKETPLACE,
            source: { kind: "local", path: "/shared/built/path" },
            scope: "user",
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
        const references = seedReferences(fs, [PROJECT_ROOT, OTHER_PROJECT_ROOT]);
        await references.addReference("1.0.0", PROJECT_ROOT);
        await references.addReference("1.0.0", OTHER_PROJECT_ROOT);
        const gitignore = new UpdateGitignore(fs);
        gitignore.remove = async () => {
          throw new Error("gitignore cleanup failed");
        };
        const useCase = new CleanWithKnownHostSource(
          fs,
          new InMemoryManifestRepository(manifest, PROJECT_ROOT),
          new CapturingLogger(),
          gitignore,
          new Map([[BINARY, new FakeHostActions({ available: true })]]),
          registry,
          undefined,
          new Map(),
          () => "/fake-home",
          references
        );

        await expect(useCase.execute({ ...AT_PROJECT, force: true })).rejects.toThrow(
          "gitignore cleanup failed"
        );
        expect(await references.listAllReferencingProjects()).toEqual([
          PROJECT_ROOT,
          OTHER_PROJECT_ROOT,
        ]);
        const userClean = userScopeCleaner({
          fs,
          repo: new InMemoryManifestRepository(),
          marketplaceRegistry: registry,
          userConfigDir: () => "/fake-home/.config/aidd",
          homeDir: () => "/fake-home",
          userSourceReferences: references,
        });
        await expect(userClean.execute({ ...AT_PROJECT, force: true })).rejects.toThrow(
          "the shared framework source"
        );
      });

      // A verb-agreement bug hides in the plural alone: the passive phrasing sidesteps the
      // question for either count, so only the plural case can pin it.
      it("names the other project still referencing the shared source in a dry-run, without dropping anything", async () => {
        const manifest = seedManifestWithNativeRegistrations();
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
        const activator = new FakeHostActions({ available: true });
        const registry = new InMemoryMarketplaceRegistry();
        await registry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name: MARKETPLACE,
            source: { kind: "local", path: "/shared/built/path" },
            scope: "user",
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
        const userSourceReferences = seedReferences(fs, [PROJECT_ROOT, OTHER_PROJECT_ROOT]);
        await userSourceReferences.addReference("1.0.0", PROJECT_ROOT);
        await userSourceReferences.addReference("1.0.0", OTHER_PROJECT_ROOT);
        const useCase = new CleanWithKnownHostSource(
          fs,
          manifestRepo,
          new CapturingLogger(),
          new UpdateGitignore(fs),
          new Map([[BINARY, activator]]),
          registry,
          undefined,
          new Map(),
          () => "/fake-home",
          userSourceReferences
        );

        const result = await useCase.execute({ ...AT_PROJECT, force: false });

        expect(result.dryRun).toBe(true);
        expect(result.preview.sharedSourceOtherProjects).toEqual([OTHER_PROJECT_ROOT]);
        // A dry-run must never write: both projects still hold their reference.
        expect(await userSourceReferences.listAllReferencingProjects()).toEqual(
          expect.arrayContaining([PROJECT_ROOT, OTHER_PROJECT_ROOT])
        );
      });

      // Two projects synced under different CLI versions record their claims under two
      // different keys, so only a read across every key sees the other project's.
      it("names the other project in a dry-run even when the two projects were recorded under different CLI versions", async () => {
        const manifest = seedManifestWithNativeRegistrations();
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
        const activator = new FakeHostActions({ available: true });
        const registry = new InMemoryMarketplaceRegistry();
        await registry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name: MARKETPLACE,
            source: { kind: "local", path: "/shared/built/path" },
            scope: "user",
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
        const userSourceReferences = seedReferences(fs, [PROJECT_ROOT, OTHER_PROJECT_ROOT]);
        await userSourceReferences.addReference("1.0.0", PROJECT_ROOT);
        await userSourceReferences.addReference("2.0.0", OTHER_PROJECT_ROOT);
        const useCase = new CleanWithKnownHostSource(
          fs,
          manifestRepo,
          new CapturingLogger(),
          new UpdateGitignore(fs),
          new Map([[BINARY, activator]]),
          registry,
          undefined,
          new Map(),
          () => "/fake-home",
          userSourceReferences
        );

        const result = await useCase.execute({ ...AT_PROJECT, force: false });

        expect(result.dryRun).toBe(true);
        expect(result.preview.sharedSourceOtherProjects).toEqual([OTHER_PROJECT_ROOT]);
      });

      // A reference sits under the CLI version that wrote it, which the running binary may
      // have moved past; `CleanUseCase` has no version reader and must still find it.
      it("drops this project's reference even though it was recorded under an older CLI version", async () => {
        const manifest = seedManifestWithNativeRegistrations();
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
        const activator = new FakeHostActions({ available: true });
        const registry = new InMemoryMarketplaceRegistry();
        await registry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name: MARKETPLACE,
            source: { kind: "local", path: "/shared/built/path" },
            scope: "user",
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
        const userSourceReferences = seedReferences(fs, [PROJECT_ROOT, OTHER_PROJECT_ROOT]);
        // Both projects registered at an older CLI version — this use case has no way to
        // know or care what version is "current" today.
        await userSourceReferences.addReference("0.9.0", PROJECT_ROOT);
        await userSourceReferences.addReference("0.9.0", OTHER_PROJECT_ROOT);
        const logger = new CapturingLogger();
        const useCase = new CleanWithKnownHostSource(
          fs,
          manifestRepo,
          logger,
          new UpdateGitignore(fs),
          new Map([[BINARY, activator]]),
          registry,
          undefined,
          new Map(),
          () => "/fake-home",
          userSourceReferences
        );

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(await userSourceReferences.listAllReferencingProjects()).not.toContain(PROJECT_ROOT);
        expect(await userSourceReferences.listAllReferencingProjects()).toContain(
          OTHER_PROJECT_ROOT
        );
        const message = logger.warnMessages.find((m) => m.includes("shared by every project"));
        expect(message).toBeDefined();
        expect(message).toContain("Still referenced by 1 other project on this machine.");
      });

      // `references.json` is a help, not an authority — a corrupted copy must never block
      // the destructive command that does not depend on it.
      it("warns and still previews a dry-run when references.json is corrupted", async () => {
        const manifest = seedManifestWithNativeRegistrations();
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
        const activator = new FakeHostActions({ available: true });
        const registry = new InMemoryMarketplaceRegistry();
        await registry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name: MARKETPLACE,
            source: { kind: "local", path: "/shared/built/path" },
            scope: "user",
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
        fs.setFile("/fake-home/.config/aidd/references.json", "not json");
        const userSourceReferences = new UserSourceReferencesAdapter(
          fs,
          () => "/fake-home/.config/aidd"
        );
        const logger = new CapturingLogger();
        const useCase = new CleanWithKnownHostSource(
          fs,
          manifestRepo,
          logger,
          new UpdateGitignore(fs),
          new Map([[BINARY, activator]]),
          registry,
          undefined,
          new Map(),
          () => "/fake-home",
          userSourceReferences
        );

        const result = await useCase.execute({ ...AT_PROJECT, force: false });

        expect(result.dryRun).toBe(true);
        expect(result.preview.sharedSourceOtherProjects).toBeUndefined();
        expect(logger.warnMessages.some((m) => m.includes("references.json"))).toBe(true);
      });

      it("warns and still drops the rest when --force runs against a corrupted references.json", async () => {
        const manifest = seedManifestWithNativeRegistrations();
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
        const activator = new FakeHostActions({ available: true });
        const registry = new InMemoryMarketplaceRegistry();
        await registry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name: MARKETPLACE,
            source: { kind: "local", path: "/shared/built/path" },
            scope: "user",
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
        fs.setFile("/fake-home/.config/aidd/references.json", "not json");
        const userSourceReferences = new UserSourceReferencesAdapter(
          fs,
          () => "/fake-home/.config/aidd"
        );
        const logger = new CapturingLogger();
        const useCase = new CleanWithKnownHostSource(
          fs,
          manifestRepo,
          logger,
          new UpdateGitignore(fs),
          new Map([[BINARY, activator]]),
          registry,
          undefined,
          new Map(),
          () => "/fake-home",
          userSourceReferences
        );

        const result = await useCase.execute({ ...AT_PROJECT, force: true });

        expect(result.dryRun).toBe(false);
        expect(logger.warnMessages.some((m) => m.includes("references.json"))).toBe(true);
      });
    });
  });
});
