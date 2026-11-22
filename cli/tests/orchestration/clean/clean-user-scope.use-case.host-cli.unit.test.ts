import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { HostActions } from "../../../src/contexts/host-registration/ports/host-actions.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { FakeHostPluginRegistry } from "../../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { claimsRecorded, hostRecord } from "../../shared/testing/host-record-reading.builder.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  CODEX_CACHE,
  manifestWithClaude,
  provenClaudeSources,
  provenHostPlugins,
  RecordingActivator,
  RecordingFileAdapter,
  seedClaudeCache,
  USER_CONFIG_DIR,
} from "../testing/clean-user-scope.builder.js";
import { userScopeCleaner } from "../testing/user-scope-cleaner.builder.js";

type HostFault = "missing catalogue" | "duplicate claim" | "disabled ref" | "missing ref";

function applyHostFault(manifest: Manifest, fault: HostFault): void {
  const registration = manifest.getNativeRegistrations(TOOL.claude);
  if (registration === undefined) throw new Error("fixture missing registration");
  if (fault === "missing catalogue")
    manifest.setNativeRegistrations(TOOL.claude, { ...registration, marketplaces: [] });
  if (fault === "duplicate claim")
    manifest.setNativeRegistrations(TOOL.claude, {
      ...registration,
      pluginClaims: [
        ...claimsRecorded(registration),
        { ref: "aidd-context@aidd-framework", dependents: [] },
      ],
    });
}

function hostPluginRegistryFor(fault: HostFault): FakeHostPluginRegistry {
  const refs: [string, { enabled: boolean }][] =
    fault === "missing ref"
      ? []
      : [["aidd-context@aidd-framework", { enabled: fault !== "disabled ref" }]];
  return new FakeHostPluginRegistry({
    location: "literal host plugin registry",
    refs: new Map(refs),
  });
}

describe("clean --scope user: host cli", () => {
  describe("driving the host CLI", () => {
    function buildUseCase(deps: {
      fs: InMemoryFileAdapter;
      logger: CapturingLogger;
      manifest?: Manifest;
      repo?: InMemoryManifestRepository;
      binary?: string;
      nativeSources?: ReadonlyMap<AiToolId, HostMarketplaceSources>;
      hostPlugins?: ReadonlyMap<AiToolId, FakeHostPluginRegistry>;
      activator: HostActions;
    }) {
      return userScopeCleaner({
        tools: registeredTools(),
        fs: deps.fs,
        repo:
          deps.repo ?? new InMemoryManifestRepository(deps.manifest ?? manifestWithClaude(TOOL)),
        logger: deps.logger,
        activators: new Map([[deps.binary ?? TOOL.claude, deps.activator]]),
        sources: deps.nativeSources ?? provenClaudeSources(TOOL),
        pluginRegistries:
          deps.hostPlugins ?? provenHostPlugins(TOOL, deps.manifest ?? manifestWithClaude(TOOL)),
      });
    }

    it("cleans an empty native registration without inventing any plugin uninstall", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "1.0.0", []);
      manifest.setNativeRegistrations(TOOL.claude, {
        binary: "claude",
        marketplaces: [],
        pluginRefs: [],
      });
      const repo = new InMemoryManifestRepository(manifest);
      const fs = new InMemoryFileAdapter();
      const sourceMarker = join(USER_CONFIG_DIR, "cache", "built", "1.0.0", "catalogue.json");
      fs.setFile(sourceMarker, "source");
      const activator = new FakeHostActions({ available: true });

      const result = await buildUseCase({
        fs,
        manifest,
        repo,
        activator,
        logger: new CapturingLogger(),
        nativeSources: new Map(),
        hostPlugins: new Map(),
      }).execute({ projectRoot: "/wherever", force: true });

      expect(result).toEqual({
        dryRun: false,
        manifestFound: true,
        preview: {
          toolIds: ["claude"],
          activePluginDependents: [],
          builtVersions: ["1.0.0"],
          referencingProjects: [],
        },
      });
      expect(repo.getCurrent()).toBeNull();
      expect(fs.has(sourceMarker)).toBe(false);
      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([]);
    });

    it("retains canonical state when the recorded host catalogue is absent", async () => {
      const manifest = manifestWithClaude(TOOL);
      const repo = new InMemoryManifestRepository(manifest);
      const fs = new RecordingFileAdapter();
      const marker = join(seedClaudeCache(fs), "marker.json");
      const activator = new FakeHostActions({ available: true });
      const source: HostMarketplaceSources = {
        read: async () => ({ location: "Claude source registry", entries: new Map() }),
      };

      await expect(
        buildUseCase({
          fs,
          manifest,
          repo,
          activator,
          logger: new CapturingLogger(),
          nativeSources: new Map([[TOOL.claude, source]]),
        }).execute({ projectRoot: "/wherever", force: true })
      ).rejects.toThrow("claude: catalogue source unproven.");

      expect(fs.order).toEqual([]);
      expect(fs.getFile(marker)).toBe("{}");
      expect(repo.getCurrent()?.toJSON()).toEqual(manifest.toJSON());
      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([]);
    });

    it.each<HostFault>(["missing catalogue", "duplicate claim", "disabled ref", "missing ref"])(
      "refuses %s before native or cache cleanup and retains the canonical manifest",
      async (fault) => {
        const manifest = manifestWithClaude(TOOL);
        applyHostFault(manifest, fault);
        const before = manifest.toJSON();
        const repo = new InMemoryManifestRepository(manifest);
        const fs = new InMemoryFileAdapter();
        const cacheMarker = join(seedClaudeCache(fs), "marker.json");
        const cacheBytes = fs.getFile(cacheMarker);
        const activator = new FakeHostActions({ available: true });
        const hostPlugins = new Map([[TOOL.claude, hostPluginRegistryFor(fault)]]);

        await expect(
          buildUseCase({
            fs,
            manifest,
            repo,
            activator,
            hostPlugins,
            logger: new CapturingLogger(),
          }).execute({ projectRoot: "/wherever", force: true })
        ).rejects.toThrow(/canonical catalogue source|duplicate canonical native ref|not enabled/);

        expect(activator.uninstalledPlugins).toEqual([]);
        expect(activator.removedMarketplaces).toEqual([]);
        expect(fs.getFile(cacheMarker)).toBe(cacheBytes);
        expect(repo.getCurrent()?.toJSON()).toEqual(before);
        expect(repo.saveCount).toBe(0);
      }
    );

    it("refuses a second missing native binary before uninstalling the first tool", async () => {
      const manifest = manifestWithClaude(TOOL);
      manifest.addTool(TOOL.copilot, "1.0.0", []);
      manifest.setNativeRegistrations(TOOL.copilot, {
        binary: "copilot",
        marketplaces: [
          {
            alias: "copilot-catalog",
            hostName: "copilot-catalog",
            provenance: {
              kind: "effective-list",
              root: "/built/copilot",
              sourceType: "local",
              source: "/built/copilot",
            },
          },
        ],
        pluginRefs: [],
      });
      const repo = new InMemoryManifestRepository(manifest);
      const fs = new InMemoryFileAdapter();
      const cacheMarker = join(seedClaudeCache(fs), "marker.json");
      const before = await fs.readFile(cacheMarker);
      const claude = new FakeHostActions({ available: true });
      const useCase = buildUseCase({
        fs,
        logger: new CapturingLogger(),
        manifest,
        repo,
        activator: claude,
      });

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        /copilot CLI is not on the PATH.*claims retained/
      );
      expect(claude.uninstalledPlugins).toEqual([]);
      expect(claude.removedMarketplaces).toEqual([]);
      expect(await fs.readFile(cacheMarker)).toBe(before);
      expect(repo.getCurrent()?.getNativeRegistrations(TOOL.claude)?.pluginClaims).toEqual(
        manifest.getNativeRegistrations(TOOL.claude)?.pluginClaims
      );
    });

    it.each(["claim", "projection"] as const)(
      "refuses an orphan machine %s before uninstalling a proven catalogue's own ref",
      async (placement) => {
        const manifest = manifestWithClaude(TOOL);
        const registrations = hostRecord(manifest.getNativeRegistrations(TOOL.claude));
        if (registrations === undefined) throw new Error("fixture missing native registration");
        manifest.setNativeRegistrations(TOOL.claude, {
          ...registrations,
          pluginRefs: [...registrations.pluginRefs, "x@B"],
          pluginClaims:
            placement === "claim"
              ? [...(registrations.pluginClaims ?? []), { ref: "x@B", dependents: [] }]
              : registrations.pluginClaims,
        });
        const repo = new InMemoryManifestRepository(manifest);
        const fs = new InMemoryFileAdapter();
        const cacheMarker = join(seedClaudeCache(fs), "marker.json");
        const before = await fs.readFile(cacheMarker);
        const activator = new FakeHostActions({ available: true });
        const useCase = buildUseCase({
          fs,
          logger: new CapturingLogger(),
          manifest,
          repo,
          activator,
        });

        await expect(
          useCase.execute({
            projectRoot: "/wherever",
            force: true,
          })
        ).rejects.toThrow(/x@B.*canonical catalogue/);
        expect(activator.uninstalledPlugins).toEqual([]);
        expect(activator.removedMarketplaces).toEqual([]);
        expect(await fs.readFile(cacheMarker)).toBe(before);
        expect(repo.getCurrent()?.getNativeRegistrations(TOOL.claude)?.pluginClaims).toEqual(
          manifest.getNativeRegistrations(TOOL.claude)?.pluginClaims
        );
      }
    );

    it("refuses duplicate host catalogue registrations before uninstall or cache purge", async () => {
      const manifest = manifestWithClaude(TOOL);
      const registrations = hostRecord(manifest.getNativeRegistrations(TOOL.claude));
      manifest.setNativeRegistrations(TOOL.claude, {
        ...registrations,
        marketplaces: [
          ...(registrations?.marketplaces ?? []),
          { ...registrations?.marketplaces[0], alias: "second-alias" },
        ],
      });
      const repo = new InMemoryManifestRepository(manifest);
      const fs = new InMemoryFileAdapter();
      const cacheMarker = join(seedClaudeCache(fs), "marker.json");
      const before = await fs.readFile(cacheMarker);
      const activator = new FakeHostActions({ available: true });
      const useCase = buildUseCase({
        fs,
        logger: new CapturingLogger(),
        manifest,
        repo,
        activator,
      });

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        /ambiguous.*aidd-framework/
      );
      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([]);
      expect(await fs.readFile(cacheMarker)).toBe(before);
      expect(repo.getCurrent()?.getNativeRegistrations(TOOL.claude)?.marketplaces).toEqual(
        manifest.getNativeRegistrations(TOOL.claude)?.marketplaces
      );
    });

    it("unregisters every marketplace at the user scope", async () => {
      const activator = new RecordingActivator([]);
      const useCase = buildUseCase({
        fs: new InMemoryFileAdapter(),
        logger: new CapturingLogger(),
        activator,
      });

      await useCase.execute({
        projectRoot: "/wherever",
        force: true,
      });

      expect(activator.removedMarketplaces).toStrictEqual(["aidd-framework"]);
      expect(activator.removedMarketplaceScopes).toStrictEqual(["user"]);
    });

    it("never treats a refused removal as one the host confirmed, so codex's cache stays", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.codex, "1.0.0", []);
      manifest.setNativeRegistrations(TOOL.codex, {
        binary: "codex",
        marketplaces: [
          {
            alias: "aidd-framework",
            hostName: "aidd-framework",
            provenance: {
              kind: "effective-list",
              root: "/built/codex",
              sourceType: "local",
              source: "/built/codex",
            },
          },
        ],
        pluginRefs: [],
      });
      const fs = new InMemoryFileAdapter();
      const leftover = join(CODEX_CACHE, "aidd-framework", "leftover.json");
      fs.setFile(leftover, "{}");
      const logger = new CapturingLogger();
      const useCase = buildUseCase({
        fs,
        logger,
        manifest,
        binary: "codex",
        nativeSources: new Map([
          [
            TOOL.codex,
            {
              read: async () => ({
                location: "host",
                entries: new Map([
                  [
                    "aidd-framework",
                    {
                      kind: "effective-list" as const,
                      root: "/built/codex",
                      sourceType: "local",
                      source: "/built/codex",
                    },
                  ],
                ]),
              }),
            },
          ],
        ]),
        activator: new FakeHostActions({ available: true, throwOnRemove: true }),
      });

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        /marketplace remove.*failed.*claims retained/
      );

      expect(fs.has(leftover)).toBe(true);
      expect(logger.warnMessages).toStrictEqual([
        "codex marketplace remove 'aidd-framework' failed: marketplace remove aidd-framework failed: 'aidd-framework' is not configured or installed",
      ]);
    });
  });
});
