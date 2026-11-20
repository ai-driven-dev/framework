import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import { FileHash } from "../../../src/shared/domain/file.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import type { AiToolId, ToolId } from "../../../src/shared/domain/tool.js";
import { FakeHostMarketplaceRegistry } from "../../contexts/host-registration/testing/fake-host-marketplace-registry.fake.js";
import { FakeHostPluginRegistry } from "../../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  CLAUDE_CACHE,
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

describe("clean --scope user", () => {
  it.each([false, true])(
    "Copilot cleans past an unclaimed uninstall tombstone, but protects a foreign enabled=%s ref",
    async (foreignEnabled) => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.copilot, "1.0.0", []);
      const source = {
        kind: "effective-list" as const,
        root: "/built/copilot",
        sourceType: "local",
        source: "/built/copilot",
      };
      manifest.setNativeRegistrations(TOOL.copilot, {
        binary: "copilot",
        marketplaces: [{ alias: "aidd-framework", hostName: "aidd-framework", provenance: source }],
        pluginRefs: ["aidd-dev@aidd-framework"],
        pluginClaims: [{ ref: "aidd-dev@aidd-framework", dependents: [] }],
      });
      const repo = new InMemoryManifestRepository(manifest);
      const hostRefs = new Map([
        ["aidd-dev@aidd-framework", { enabled: true }],
        ["aidd-pm@aidd-framework", { enabled: foreignEnabled }],
      ]);
      const activator = new FakeHostActions({ available: true });
      const clean = userScopeCleaner({
        repo,
        activators: new Map([[TOOL.copilot, activator]]),
        sources: new Map([
          [
            TOOL.copilot,
            {
              read: async () => ({
                location: "marketplace list",
                entries: new Map([["aidd-framework", source]]),
              }),
            },
          ],
        ]),
        pluginRegistries: new Map([
          [TOOL.copilot, new FakeHostPluginRegistry({ location: "plugins", refs: hostRefs })],
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
    const machine = manifestWithClaude();
    class LockedRepository extends InMemoryManifestRepository {
      async withExclusiveAccess<T>(action: () => Promise<T>): Promise<T> {
        // A concurrent install completed while clean was waiting for the lock.
        const registration = machine.getNativeRegistrations(TOOL.claude);
        if (registration === undefined) throw new Error("fixture missing native registration");
        machine.setNativeRegistrations(TOOL.claude, {
          ...registration,
          pluginClaims: [{ ref: "aidd-context@aidd-framework", dependents: ["/project-b"] }],
        });
        return action();
      }
    }
    const repo = new LockedRepository(machine);
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
      fs,
      repo,
      activators: new Map([[TOOL.claude, activator]]),
      sources: provenClaudeSources(),
      pluginRegistries: provenHostPlugins(machine),
    });

    await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
      /user-scope plugin files.*active projects.*\/project-b/
    );

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(fs.getFile(sourceMarker)).toBe("source");
    expect(fs.getFile(cacheMarker)).toBe("{}");
    expect(fs.getFile(fetched)).toBe("framework clone");
    expect(fs.getFile(plugins)).toBe("plugin clone");
    expect(repo.getCurrent()?.getNativeRegistrations(TOOL.claude)?.pluginClaims).toEqual([
      { ref: "aidd-context@aidd-framework", dependents: ["/project-b"] },
    ]);
  });

  it("refuses an owned catalogue with a foreign enabled plugin ref before any global clean effect", async () => {
    const machine = manifestWithClaude();
    const repo = new InMemoryManifestRepository(machine);
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
      fs,
      repo,
      activators: new Map([[TOOL.claude, activator]]),
      sources: provenClaudeSources(),
      pluginRegistries: new Map([[TOOL.claude, hostPlugins]]),
    });
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(
      /foreign.*ref.*foreign@aidd-framework/
    );
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(await fs.readFile(foreignCache)).toBe("foreign bytes");
    expect(repo.getCurrent()?.getNativeRegistrations(TOOL.claude)?.pluginClaims).toHaveLength(1);
  });
  it("preflights every native source before uninstalling any other catalogue", async () => {
    const machine = manifestWithClaude();
    machine.addTool(TOOL.codex, "1.0.0", []);
    machine.setNativeRegistrations(TOOL.codex, {
      binary: "codex",
      marketplaces: [
        {
          alias: "foreign-alias",
          hostName: "foreign-name",
          provenance: { kind: "effective-list", root: "/old", sourceType: "local", source: "/old" },
        },
      ],
      pluginRefs: ["plugin@foreign-name"],
      pluginClaims: [{ ref: "plugin@foreign-name", dependents: [] }],
    });
    const claude = new RecordingActivator([]);
    const codex = new RecordingActivator([]);
    const repo = new InMemoryManifestRepository(machine);
    const fs = new RecordingFileAdapter();
    const claudeSource = provenClaudeSources().get(TOOL.claude);
    if (claudeSource === undefined) throw new Error("fixture missing Claude source reader");
    const sources = new Map<AiToolId, HostMarketplaceSources>([
      [TOOL.claude, claudeSource],
      [
        TOOL.codex,
        {
          read: async () => ({
            location: "host",
            entries: new Map([
              [
                "foreign-name",
                {
                  kind: "effective-list",
                  root: "/foreign",
                  sourceType: "local",
                  source: "/foreign",
                },
              ],
            ]),
          }),
        },
      ],
    ]);
    const useCase = userScopeCleaner({
      fs,
      repo,
      activators: new Map([
        [TOOL.claude, claude],
        [TOOL.codex, codex],
      ]),
      sources,
      pluginRegistries: provenHostPlugins(machine),
    });
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(
      /current host source differs.*reconcile manually/
    );
    expect(claude.uninstalledPlugins).toEqual([]);
    expect(claude.removedMarketplaces).toEqual([]);
    expect(codex.uninstalledPlugins).toEqual([]);
    expect(codex.removedMarketplaces).toEqual([]);
    expect(repo.getCurrent()?.getNativeRegistrations(TOOL.claude)).toBeDefined();
  });
  it("refuses all native host mutations when a stale canonical source points at a foreign Codex catalogue", async () => {
    const machine = Manifest.create();
    machine.addTool(TOOL.codex, "1.0.0", []);
    machine.setNativeRegistrations(TOOL.codex, {
      binary: "codex",
      marketplaces: [
        {
          alias: "alias",
          hostName: "foreign-name",
          provenance: { kind: "effective-list", root: "/old", sourceType: "local", source: "/old" },
        },
      ],
      pluginRefs: ["plugin@foreign-name"],
      pluginClaims: [{ ref: "plugin@foreign-name", dependents: [] }],
    });
    const repo = new InMemoryManifestRepository(machine);
    const fs = new RecordingFileAdapter();
    const activator = new RecordingActivator([]);
    const source: HostMarketplaceSources = {
      read: async () => ({
        location: "host",
        entries: new Map([
          [
            "foreign-name",
            { kind: "effective-list", root: "/foreign", sourceType: "local", source: "/foreign" },
          ],
        ]),
      }),
    };
    const useCase = userScopeCleaner({
      fs,
      repo,
      activators: new Map([[TOOL.codex, activator]]),
      sources: new Map([[TOOL.codex, source]]),
    });
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(
      /current host source differs.*reconcile manually/
    );
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(repo.getCurrent()?.getNativeRegistrations(TOOL.codex)?.marketplaces).toHaveLength(1);
  });
  it("refuses an active B native ref even with force, then succeeds only after B detaches", async () => {
    const machine = manifestWithClaude();
    const registrations = machine.getNativeRegistrations(TOOL.claude);
    if (registrations === undefined) throw new Error("fixture missing native registration");
    machine.setNativeRegistrations(TOOL.claude, {
      ...registrations,
      pluginClaims: [{ ref: "aidd-context@aidd-framework", dependents: ["/B"] }],
    });
    const repo = new InMemoryManifestRepository(machine);
    const fs = new RecordingFileAdapter();
    const activator = new RecordingActivator([]);
    const useCase = userScopeCleaner({
      fs,
      repo,
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
      pluginRegistries: provenHostPlugins(machine),
    });
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(
      /active projects.*\/B/
    );
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(repo.getCurrent()?.getNativeRegistrations(TOOL.claude)?.pluginClaims).toEqual([
      { ref: "aidd-context@aidd-framework", dependents: ["/B"] },
    ]);
    machine.setNativeRegistrations(TOOL.claude, {
      ...registrations,
      pluginClaims: [{ ref: "aidd-context@aidd-framework", dependents: [] }],
    });
    await useCase.execute({ projectRoot: "/A", force: true });
    expect(activator.uninstalledPlugins).toEqual(["aidd-context@aidd-framework"]);
    expect(activator.removedMarketplaces).toEqual(["aidd-framework"]);
    expect(repo.getCurrent()).toBeNull();
  });

  it("refuses an active B Cursor user plugin but never treats project files as machine-owned", async () => {
    const userFile = join(homedir(), ".cursor", "plugins", "local", "shared", "skills", "x.md");
    const projectFile = "/A/skills/local.md";
    const fs = new RecordingFileAdapter();
    fs.setFile(userFile, "shared bytes");
    fs.setFile(projectFile, "project bytes");
    const machine = Manifest.create();
    machine.addTool(TOOL.cursor, "1.0.0", []);
    const shared = InstalledPlugin.fromMetadata(
      "shared",
      "1.0.0",
      { kind: "local", path: "/source" },
      false,
      "user"
    )
      .withFiles(new Map([["shared/skills/x.md", FileHash.of("shared bytes").value]]))
      .withDependents(["/B"]);
    machine.addPlugin(TOOL.cursor, shared);
    machine.addPlugin(
      TOOL.cursor,
      InstalledPlugin.fromMetadata(
        "local",
        "1.0.0",
        { kind: "local", path: "/source" },
        false,
        "project"
      )
        .withFiles(new Map([["skills/local.md", "hash"]]))
        .withDependents(["/project-foreign"])
    );
    const repo = new InMemoryManifestRepository(machine);
    const useCase = userScopeCleaner({ fs, repo, homeDir: homedir });

    expect(
      (await useCase.execute({ projectRoot: "/A", force: false })).preview.activePluginDependents
    ).toEqual(["/B"]);
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(/\/B/);
    expect(fs.has(userFile)).toBe(true);
    expect(fs.has(projectFile)).toBe(true);
    expect(
      repo
        .getCurrent()
        ?.getPlugins(TOOL.cursor)
        .find((plugin) => plugin.name === "shared")?.dependents
    ).toEqual(["/B"]);

    machine.updatePlugin(TOOL.cursor, shared.withDependents([]));
    await useCase.execute({ projectRoot: "/A", force: true });
    expect(repo.getCurrent()).toBeNull();
    expect(fs.has(userFile)).toBe(false);
    expect(fs.order).toContain(`deleteFile:${userFile}`);
    expect(fs.has(projectFile)).toBe(true);
  });

  it("retains canonical claims if the user catalogue registry refuses the final delete", async () => {
    class RefusingRegistry extends InMemoryMarketplaceRegistry {
      override async delete(_root: string, _name: string, _scope: Scope): Promise<void> {
        throw new Error("registry delete failed");
      }
    }
    const repo = new InMemoryManifestRepository(Manifest.create());
    const useCase = userScopeCleaner({
      fs: new RecordingFileAdapter(),
      repo,
      marketplaceRegistry: new RefusingRegistry(),
    });
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(
      /registry delete failed/
    );
    expect(repo.getCurrent()).not.toBeNull();
  });

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
        /the shared framework source.*active projects.*\/project-a/
      );
      expect(fs.order).not.toContain(`deleteDirectory:${join(USER_CONFIG_DIR, "cache", "built")}`);
      // No manifest means no `nativeRegistrations` to drive a host's own CLI through —
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
        InstalledPlugin.fromMetadata(
          "aidd-context",
          "1.0.0",
          { kind: "local", path: "/whatever" },
          false,
          "project"
        ).withFiles(new Map([["skills/x.md", "hash"]]))
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
