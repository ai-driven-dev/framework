import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { HostActions } from "../../../src/contexts/host-registration/ports/host-actions.js";
import type { HostPluginRegistry } from "../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import type { AiToolId, ToolId } from "../../../src/shared/domain/tool.js";
import { FakeHostPluginRegistry } from "../../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  AT_PROJECT,
  BINARY,
  CleanWithKnownHostSource,
  CrashingUninstallActivator,
  claudeRefOnHost,
  MARKETPLACE,
  PROJECT_ROOT,
  REF,
  seedClaudeNativeRegistrations,
  seedManifestWithNativeRegistrations,
  seedMarketplaceRegistry,
} from "../testing/clean-project.builder.js";

describe("clean: host calls", () => {
  describe("undoing a host's own native registration", () => {
    describe("what the host is told, word for word", () => {
      const HOME = "/fake-home";
      const CODEX_CACHE = join(HOME, ".codex", "plugins", "cache");

      function buildUseCase(deps: {
        manifest: Manifest;
        fs: InMemoryFileAdapter;
        logger: CapturingLogger;
        activators: ReadonlyMap<string, HostActions>;
        registry: InMemoryMarketplaceRegistry | undefined;
        hostPluginRegistries?: ReadonlyMap<AiToolId, HostPluginRegistry>;
      }): CleanWithKnownHostSource {
        return new CleanWithKnownHostSource(
          deps.fs,
          new InMemoryManifestRepository(deps.manifest, PROJECT_ROOT),
          deps.logger,
          new UpdateGitignore(deps.fs),
          deps.activators,
          deps.registry,
          undefined,
          new Map(),
          () => HOME,
          undefined,
          deps.hostPluginRegistries
        );
      }

      it("leaves a lost-alias registration and its unclaimed machine-global ref untouched", async () => {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        fs.setFile(join(CODEX_CACHE, MARKETPLACE, "leftover.json"), "{}");
        const logger = new CapturingLogger();
        const activator = new FakeHostActions({ available: true });
        const registry = new InMemoryMarketplaceRegistry();
        await registry.seed(
          PROJECT_ROOT,
          Marketplace.create({
            name: "other-mkt",
            source: { kind: "local", path: "/other/built/path" },
            scope: "project",
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
        const useCase = buildUseCase({
          manifest: seedManifestWithNativeRegistrations(),
          fs,
          logger,
          activators: new Map([[BINARY, activator]]),
          registry,
        });

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(activator.uninstalledPlugins).toStrictEqual([]);
        expect(activator.removedMarketplaces).toStrictEqual([]);
        expect(logger.warnMessages).toStrictEqual([
          `codex: '${REF}' has no canonical machine claim — left enabled for manual reconciliation; project claim detached after local clean.`,
          `codex: '${MARKETPLACE}' is no longer a registered marketplace here, so its scope cannot be resolved — its codex registration was left in place.`,
          `codex: cache for '${MARKETPLACE}' left in place, its own removal was not confirmed: ${join(CODEX_CACHE, MARKETPLACE)}`,
        ]);
      });

      it("leaves a registration in place when no marketplace registry is wired in at all", async () => {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT, join(CODEX_CACHE, MARKETPLACE)]);
        const logger = new CapturingLogger();
        const activator = new FakeHostActions({ available: true });
        const useCase = buildUseCase({
          manifest: seedManifestWithNativeRegistrations(),
          fs,
          logger,
          activators: new Map([[BINARY, activator]]),
          registry: undefined,
        });

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(activator.uninstalledPlugins).toStrictEqual([]);
        expect(activator.removedMarketplaces).toStrictEqual([]);
        expect(logger.warnMessages).toStrictEqual([
          `codex: '${REF}' has no canonical machine claim — left enabled for manual reconciliation; project claim detached after local clean.`,
          `codex: '${MARKETPLACE}' is no longer a registered marketplace here, so its scope cannot be resolved — its codex registration was left in place.`,
          `codex: cache for '${MARKETPLACE}' left in place, its own removal was not confirmed: ${join(CODEX_CACHE, MARKETPLACE)}`,
        ]);
      });

      it("names a refused plugin uninstall by the host's own words, after trying both scopes", async () => {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const logger = new CapturingLogger();
        const activator = new FakeHostActions({
          available: true,
          failOnUninstall: [REF],
        });
        const useCase = buildUseCase({
          manifest: seedClaudeNativeRegistrations(),
          fs,
          logger,
          activators: new Map([[TOOL.claude, activator]]),
          registry: seedMarketplaceRegistry(),
          hostPluginRegistries: claudeRefOnHost(),
        });

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(activator.uninstalledPluginScopes).toStrictEqual(["project", "user"]);
        expect(logger.warnMessages).toStrictEqual([
          `claude plugin uninstall '${REF}' failed: plugin \`${REF}\` is not installed`,
        ]);
      });

      it("propagates an activator failure that is not the host refusing", async () => {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const useCase = buildUseCase({
          manifest: seedClaudeNativeRegistrations(),
          fs,
          logger: new CapturingLogger(),
          activators: new Map([[TOOL.claude, new CrashingUninstallActivator()]]),
          registry: seedMarketplaceRegistry(),
          hostPluginRegistries: claudeRefOnHost("project"),
        });

        await expect(useCase.execute({ ...AT_PROJECT, force: true })).rejects.toThrow(
          "activator crashed uninstalling a plugin"
        );
      });

      function seedSharedRegistry(): InMemoryMarketplaceRegistry {
        const registry = new InMemoryMarketplaceRegistry();
        registry.seed(
          PROJECT_ROOT,
          Marketplace.create({
            name: MARKETPLACE,
            source: { kind: "local", path: "/shared/built/path" },
            scope: "user",
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
        return registry;
      }

      function seedRegistrations(toolId: ToolId, binary: string): Manifest {
        const manifest = Manifest.create();
        manifest.addTool(toolId, "1.0.0", []);
        manifest.setNativeRegistrations(toolId, {
          binary,
          marketplaces: [
            {
              alias: MARKETPLACE,
              hostName: MARKETPLACE,
              provenance: {
                kind: "effective-list",
                root: "/some/built/path",
                sourceType: "local",
                source: "/some/built/path",
              },
            },
          ],
          pluginRefs: [],
        });
        return manifest;
      }

      it("names no cache for a shared marketplace at a host whose profile declares no cache directory (copilot)", async () => {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const logger = new CapturingLogger();
        const useCase = buildUseCase({
          manifest: seedRegistrations(TOOL.copilot, "copilot"),
          fs,
          logger,
          activators: new Map([[TOOL.copilot, new FakeHostActions({ available: true })]]),
          registry: seedSharedRegistry(),
        });

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(logger.warnMessages).toStrictEqual([
          `copilot: '${MARKETPLACE}' is shared by every project on this machine — left registered. Its entry survives at userConfigDir()/marketplaces.json.`,
        ]);
      });

      it("detaches project A without host mutation when a shared Copilot source is unreadable", async () => {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        fs.setFile(join(PROJECT_ROOT, "marker"), "");
        fs.setFile(join("/other-project", "marker"), "");
        const references = new UserSourceReferencesAdapter(fs, () => "/fake-home/.config/aidd");
        await references.addReference("1.0.0", PROJECT_ROOT);
        await references.addReference("1.0.0", "/other-project");
        const activator = new FakeHostActions({ available: true });
        const useCase = new CleanWithKnownHostSource(
          fs,
          new InMemoryManifestRepository(seedRegistrations(TOOL.copilot, "copilot"), PROJECT_ROOT),
          new CapturingLogger(),
          new UpdateGitignore(fs),
          new Map([[TOOL.copilot, activator]]),
          seedSharedRegistry(),
          undefined,
          new Map(),
          () => "/fake-home",
          references,
          undefined,
          undefined,
          new Map()
        );

        const result = await useCase.execute({ ...AT_PROJECT, force: true });

        expect(result.manifestFound).toBe(true);
        expect(activator.removedMarketplaces).toEqual([]);
        expect(activator.uninstalledPlugins).toEqual([]);
        expect(await references.listAllReferencingProjects()).toEqual(["/other-project"]);
      });

      it("does not uninstall an unclaimed shared ref when its current source is unreadable", async () => {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        fs.setFile(join(PROJECT_ROOT, "marker"), "");
        const references = new UserSourceReferencesAdapter(fs, () => "/fake-home/.config/aidd");
        await references.addReference("1.0.0", PROJECT_ROOT);
        const manifest = seedRegistrations(TOOL.copilot, "copilot");
        manifest.setNativeRegistrations(TOOL.copilot, {
          binary: "copilot",
          marketplaces: manifest.getNativeRegistrations(TOOL.copilot)?.marketplaces ?? [],
          pluginRefs: [`demo@${MARKETPLACE}`],
        });
        const activator = new FakeHostActions({ available: true });
        const useCase = new CleanWithKnownHostSource(
          fs,
          new InMemoryManifestRepository(manifest, PROJECT_ROOT),
          new CapturingLogger(),
          new UpdateGitignore(fs),
          new Map([[TOOL.copilot, activator]]),
          seedSharedRegistry(),
          undefined,
          new Map(),
          () => "/fake-home",
          references,
          undefined,
          undefined,
          new Map()
        );

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(activator.uninstalledPlugins).toEqual([]);
        expect(activator.removedMarketplaces).toEqual([]);
        expect(await references.listAllReferencingProjects()).toEqual([]);
      });

      it("leaves a machine-global ref enabled without a canonical claim even when host source is proven", async () => {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        fs.setFile(join(PROJECT_ROOT, "marker"), "");
        const references = new UserSourceReferencesAdapter(fs, () => "/fake-home/.config/aidd");
        await references.addReference("1.0.0", PROJECT_ROOT);
        const manifest = seedRegistrations(TOOL.codex, "codex");
        manifest.setNativeRegistrations(TOOL.codex, {
          binary: "codex",
          marketplaces: manifest.getNativeRegistrations(TOOL.codex)?.marketplaces ?? [],
          pluginRefs: [`demo@${MARKETPLACE}`],
        });
        const activator = new FakeHostActions({ available: true });
        const hostRefs = new Map<AiToolId, HostPluginRegistry>([
          [
            TOOL.codex,
            new FakeHostPluginRegistry({
              location: "Codex user-global registry",
              refs: new Map([[`demo@${MARKETPLACE}`, { enabled: true }]]),
            }),
          ],
        ]);
        const useCase = new CleanWithKnownHostSource(
          fs,
          new InMemoryManifestRepository(manifest, PROJECT_ROOT),
          new CapturingLogger(),
          new UpdateGitignore(fs),
          new Map([[TOOL.codex, activator]]),
          seedSharedRegistry(),
          undefined,
          new Map(),
          () => "/fake-home",
          references,
          hostRefs
        );

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(activator.uninstalledPlugins).toEqual([]);
        expect(activator.removedMarketplaces).toEqual([]);
        expect(await references.listAllReferencingProjects()).toEqual([]);
      });

      it("names no cache for a shared marketplace at a tool that drives no native CLI (cursor)", async () => {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const logger = new CapturingLogger();
        const useCase = buildUseCase({
          manifest: seedRegistrations(TOOL.cursor, "cursor"),
          fs,
          logger,
          activators: new Map([[TOOL.cursor, new FakeHostActions({ available: true })]]),
          registry: seedSharedRegistry(),
        });

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(logger.warnMessages).toStrictEqual([
          `cursor: '${MARKETPLACE}' is shared by every project on this machine — left registered. Its entry survives at userConfigDir()/marketplaces.json.`,
        ]);
      });

      it("never treats a shared marketplace it left registered as one the host forgot, so its cache stays", async () => {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        fs.setFile(join(CODEX_CACHE, MARKETPLACE, "leftover.json"), "{}");
        const logger = new CapturingLogger();
        const useCase = buildUseCase({
          manifest: seedRegistrations(TOOL.codex, BINARY),
          fs,
          logger,
          activators: new Map([[BINARY, new FakeHostActions({ available: true })]]),
          registry: seedSharedRegistry(),
        });

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(fs.has(join(CODEX_CACHE, MARKETPLACE, "leftover.json"))).toBe(true);
        expect(logger.warnMessages).toStrictEqual([
          `codex: '${MARKETPLACE}' is shared by every project on this machine — left registered. Its entry survives at userConfigDir()/marketplaces.json, and its cache at: ${join(CODEX_CACHE, MARKETPLACE)}.`,
          `codex: cache for '${MARKETPLACE}' left in place, its own removal was not confirmed: ${join(CODEX_CACHE, MARKETPLACE)}`,
        ]);
      });

      it("names no surviving cache when the absent binary's profile declares no cache directory (copilot)", async () => {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const logger = new CapturingLogger();
        const useCase = buildUseCase({
          manifest: seedRegistrations(TOOL.copilot, "copilot"),
          fs,
          logger,
          activators: new Map(),
          registry: seedSharedRegistry(),
        });

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(logger.warnMessages).toStrictEqual([
          "copilot: registration left in place, the copilot CLI is not on the PATH.",
        ]);
      });

      it("names no surviving cache when the absent binary belongs to a tool that drives no native CLI (cursor)", async () => {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const logger = new CapturingLogger();
        const useCase = buildUseCase({
          manifest: seedRegistrations(TOOL.cursor, "cursor"),
          fs,
          logger,
          activators: new Map(),
          registry: seedSharedRegistry(),
        });

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(logger.warnMessages).toStrictEqual([
          "cursor: registration left in place, the cursor CLI is not on the PATH.",
        ]);
      });

      it("names no surviving cache when the absent binary registered no marketplace", async () => {
        const manifest = Manifest.create();
        manifest.addTool(TOOL.codex, "1.0.0", []);
        manifest.setNativeRegistrations(TOOL.codex, {
          binary: BINARY,
          marketplaces: [],
          pluginRefs: [REF],
        });
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const logger = new CapturingLogger();
        const useCase = buildUseCase({
          manifest,
          fs,
          logger,
          activators: new Map(),
          registry: seedMarketplaceRegistry(),
        });

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(logger.warnMessages).toStrictEqual([
          "codex: registration left in place, the codex CLI is not on the PATH.",
        ]);
      });
    });
  });
});
