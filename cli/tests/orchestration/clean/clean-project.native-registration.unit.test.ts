import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import { FakeHostPluginRegistry } from "../../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  AssertingActivator,
  AT_PROJECT,
  BINARY,
  CleanWithKnownHostSource,
  claudeRefOnHost,
  MARKETPLACE,
  OrderRecordingActivator,
  PROJECT_ROOT,
  REF,
  seedClaudeNativeRegistrations,
  seedManifestWithNativeRegistrations,
  seedMarketplaceRegistry,
} from "../testing/clean-project.builder.js";

describe("clean: native registration", () => {
  describe("undoing a host's own native registration", () => {
    it("refuses a repointed native catalogue before shared reference or local deletion", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.codex, "1.0.0", []);
      manifest.setNativeRegistrations(TOOL.codex, {
        binary: BINARY,
        marketplaces: [
          {
            alias: MARKETPLACE,
            hostName: MARKETPLACE,
            provenance: {
              kind: "effective-list",
              root: "/aidd/built",
              sourceType: "local",
              source: "/aidd/built",
            },
          },
        ],
        pluginRefs: [REF],
      });
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      fs.setFile(join(PROJECT_ROOT, "marker"), "keep");
      fs.setFile("/other-project/marker", "keep");
      const references = new UserSourceReferencesAdapter(fs, () => "/fake-home/.config/aidd");
      await references.addReference("1.0.0", PROJECT_ROOT);
      await references.addReference("1.0.0", "/other-project");
      const activator = new FakeHostActions({ available: true });
      const sourceReader: HostMarketplaceSources = {
        read: async () => ({
          location: "fake codex host",
          entries: new Map([
            [
              MARKETPLACE,
              {
                kind: "effective-list" as const,
                root: "/foreign/built",
                sourceType: "local",
                source: "/foreign/built",
              },
            ],
          ]),
        }),
      };
      const useCase = new CleanWithKnownHostSource(
        fs,
        new InMemoryManifestRepository(manifest, PROJECT_ROOT),
        new CapturingLogger(),
        new UpdateGitignore(fs),
        new Map([[BINARY, activator]]),
        seedMarketplaceRegistry(),
        undefined,
        new Map(),
        () => "/fake-home",
        references,
        new Map(),
        undefined,
        new Map([[TOOL.codex, sourceReader]])
      );

      await expect(useCase.execute({ ...AT_PROJECT, force: true })).rejects.toThrow("differs");

      expect(await references.listAllReferencingProjects()).toContain(PROJECT_ROOT);
      expect(await references.listAllReferencingProjects()).toContain("/other-project");
      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([]);
      expect(fs.getFile(join(PROJECT_ROOT, "marker"))).toBe("keep");
    });

    it("refuses a foreign enabled ref inside an otherwise AIDD-owned catalogue", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.codex, "1.0.0", []);
      manifest.setNativeRegistrations(TOOL.codex, {
        binary: BINARY,
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
        pluginRefs: [REF],
      });
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      fs.setFile(join(PROJECT_ROOT, "marker"), "keep");
      fs.setFile("/other-project/marker", "keep");
      const references = new UserSourceReferencesAdapter(fs, () => "/fake-home/.config/aidd");
      await references.addReference("1.0.0", PROJECT_ROOT);
      await references.addReference("1.0.0", "/other-project");
      const activator = new FakeHostActions({ available: true });
      const hostRefs = new FakeHostPluginRegistry({
        location: "fake codex plugins",
        refs: new Map([
          [REF, { enabled: true }],
          ["foreign@aidd-framework", { enabled: true }],
        ]),
      });
      const useCase = new CleanWithKnownHostSource(
        fs,
        new InMemoryManifestRepository(manifest, PROJECT_ROOT),
        new CapturingLogger(),
        new UpdateGitignore(fs),
        new Map([[BINARY, activator]]),
        seedMarketplaceRegistry(),
        undefined,
        new Map(),
        () => "/fake-home",
        references,
        new Map([[TOOL.codex, hostRefs]])
      );

      await expect(useCase.execute({ ...AT_PROJECT, force: true })).rejects.toThrow("foreign");

      expect(await references.listAllReferencingProjects()).toContain(PROJECT_ROOT);
      expect(await references.listAllReferencingProjects()).toContain("/other-project");
      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([]);
      expect(fs.getFile(join(PROJECT_ROOT, "marker"))).toBe("keep");
    });

    it("leaves an unclaimed machine-global ref enabled while removing its empty project catalogue", async () => {
      const manifest = seedManifestWithNativeRegistrations();
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
      const activator = new FakeHostActions({ available: true });
      const useCase = new CleanWithKnownHostSource(
        fs,
        manifestRepo,
        new CapturingLogger(),
        new UpdateGitignore(fs),
        new Map([[BINARY, activator]]),
        seedMarketplaceRegistry()
      );

      await useCase.execute({ ...AT_PROJECT, force: true });

      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([MARKETPLACE]);
      expect(manifestRepo.getCurrent()).toBeNull();
    });

    it("leaves both an unclaimed machine-global ref and its shared catalogue registered", async () => {
      const manifest = seedManifestWithNativeRegistrations();
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
      const activator = new FakeHostActions({ available: true });
      const registry = new InMemoryMarketplaceRegistry();
      registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: MARKETPLACE,
          source: { kind: "local", path: "/shared/built/path" },
          scope: "user",
          addedAt: "2026-01-01T00:00:00.000Z",
        })
      );
      const logger = new CapturingLogger();
      const HOME = "/fake-home";
      const useCase = new CleanWithKnownHostSource(
        fs,
        manifestRepo,
        logger,
        new UpdateGitignore(fs),
        new Map([[BINARY, activator]]),
        registry,
        undefined,
        new Map(),
        () => HOME
      );

      await useCase.execute({ ...AT_PROJECT, force: true });

      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([]);
      expect(logger.warnMessages.join("\n")).toContain("no canonical machine claim");
      // The message must name all three survivors: the host's own registration,
      // `userConfigDir()/marketplaces.json`, and the tool's own plugin cache.
      const message = logger.warnMessages.find(
        (m) => m.includes(MARKETPLACE) && m.includes("shared by every project")
      );
      expect(message).toBeDefined();
      expect(message).toContain("userConfigDir()/marketplaces.json");
      expect(message).toContain(join(HOME, ".codex", "plugins", "cache", MARKETPLACE));
    });

    describe("uninstalling at the scope a plugin was actually registered at", () => {
      const CLAUDE_BINARY = "claude";
      const CLAUDE_MARKETPLACE = "aidd-framework";
      const CLAUDE_REF = "aidd-context@aidd-framework";

      function seedClaudeManifest(pluginScope: Scope): Manifest {
        const manifest = Manifest.create();
        manifest.addTool(TOOL.claude, "1.0.0", []);
        manifest.addPlugin(
          TOOL.claude,
          InstalledPlugin.fromMetadata(
            "aidd-context",
            "1.0.0",
            { kind: "github", repo: "ai-driven-dev/framework" },
            true,
            pluginScope,
            CLAUDE_MARKETPLACE
          )
        );
        manifest.setNativeRegistrations(TOOL.claude, {
          binary: CLAUDE_BINARY,
          marketplaces: [
            {
              alias: CLAUDE_MARKETPLACE,
              hostName: CLAUDE_MARKETPLACE,
              provenance: { kind: "registry", source: "/some/built/path" },
            },
          ],
          pluginRefs: [CLAUDE_REF],
        });
        return manifest;
      }

      function seedClaudeMarketplaceRegistry(): InMemoryMarketplaceRegistry {
        const registry = new InMemoryMarketplaceRegistry();
        registry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name: CLAUDE_MARKETPLACE,
            source: { kind: "local", path: "/some/built/path" },
            scope: "project",
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
        return registry;
      }

      // A real `claude` binary registers at its own implicit default `"user"` whatever the
      // manifest recorded, so a `"project"`-only uninstall left the plugin behind silently.
      it("falls back to the other scope when the manifest's own scope does not match what was actually registered, with no host registry to ask", async () => {
        const manifest = seedClaudeManifest("project");
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
        const activator = new FakeHostActions({
          available: true,
          installedAtScope: new Map([[CLAUDE_REF, "user"]]),
        });
        const useCase = new CleanWithKnownHostSource(
          fs,
          manifestRepo,
          new CapturingLogger(),
          new UpdateGitignore(fs),
          new Map([[CLAUDE_BINARY, activator]]),
          seedClaudeMarketplaceRegistry()
        );

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(activator.uninstalledPlugins).toEqual([CLAUDE_REF]);
        expect(activator.uninstalledPluginScopes).toEqual(["project", "user"]);
      });
    });

    it("warns and leaves the registration in place when the tool's CLI is not on PATH", async () => {
      const manifest = seedManifestWithNativeRegistrations();
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
      const activator = new FakeHostActions({ available: false });
      const logger = new CapturingLogger();
      const useCase = new CleanWithKnownHostSource(
        fs,
        manifestRepo,
        logger,
        new UpdateGitignore(fs),
        new Map([[BINARY, activator]]),
        seedMarketplaceRegistry()
      );

      await useCase.execute({ ...AT_PROJECT, force: true });

      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([]);
      expect(logger.warnMessages).toHaveLength(1);
      expect(logger.warnMessages[0]).toContain("the codex CLI is not on the PATH.");
    });

    it("uninstalls the plugin ref before removing the marketplace, for the same tool", async () => {
      const manifest = seedClaudeNativeRegistrations();
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
      const calls: string[] = [];
      const activator = new OrderRecordingActivator(calls);
      const useCase = new CleanWithKnownHostSource(
        fs,
        manifestRepo,
        new CapturingLogger(),
        new UpdateGitignore(fs),
        new Map([[TOOL.claude, activator]]),
        seedMarketplaceRegistry(),
        undefined,
        new Map(),
        undefined,
        undefined,
        claudeRefOnHost("project")
      );

      await useCase.execute({ ...AT_PROJECT, force: true });

      expect(calls).toEqual([`uninstall:${REF}`, `removeMarketplace:${MARKETPLACE}`]);
    });

    it("undoes the native registration before the built marketplace tree it points at is deleted", async () => {
      const manifest = seedManifestWithNativeRegistrations();
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const builtPath = join(
        PROJECT_ROOT,
        ".aidd",
        "cache",
        "built",
        MARKETPLACE,
        BINARY,
        "x.json"
      );
      await fs.writeFile(builtPath, "{}");
      const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
      let builtTreeExistedAtRemoveMarketplace: boolean | null = null;
      const activator = new AssertingActivator(async () => {
        builtTreeExistedAtRemoveMarketplace = fs.has(builtPath);
      });
      const useCase = new CleanWithKnownHostSource(
        fs,
        manifestRepo,
        new CapturingLogger(),
        new UpdateGitignore(fs),
        new Map([[BINARY, activator]]),
        seedMarketplaceRegistry()
      );

      await useCase.execute({ ...AT_PROJECT, force: true });

      expect(builtTreeExistedAtRemoveMarketplace).toBe(true);
    });

    it("names the native registration a dry-run preview will undo, without touching it", async () => {
      const manifest = seedManifestWithNativeRegistrations();
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
      const activator = new FakeHostActions({ available: true });
      const useCase = new CleanWithKnownHostSource(
        fs,
        manifestRepo,
        new CapturingLogger(),
        new UpdateGitignore(fs),
        new Map([[BINARY, activator]]),
        seedMarketplaceRegistry()
      );

      const result = await useCase.execute({ ...AT_PROJECT, force: false });

      expect(result.dryRun).toBe(true);
      expect(result.preview.nativeRegistrations).toEqual([
        {
          toolId: TOOL.codex,
          binary: BINARY,
          marketplaceCount: 1,
          pluginRefCount: 1,
          cachePaths: [join(homedir(), ".codex", "plugins", "cache", MARKETPLACE)],
        },
      ]);
      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([]);
    });

    it("removes the marketplace under its catalog's own host name, not this project's local alias for it", async () => {
      const ALIAS = "userscoped";
      const HOST_NAME = "user-mkt";
      const manifest = Manifest.create();
      manifest.addTool(TOOL.codex, "1.0.0", []);
      manifest.setNativeRegistrations(TOOL.codex, {
        binary: BINARY,
        marketplaces: [
          {
            alias: ALIAS,
            hostName: HOST_NAME,
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
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
      const activator = new FakeHostActions({ available: true });
      const registry = new InMemoryMarketplaceRegistry();
      registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: ALIAS,
          source: { kind: "local", path: "/some/built/path" },
          scope: "project",
          addedAt: "2026-01-01T00:00:00.000Z",
        })
      );
      const useCase = new CleanWithKnownHostSource(
        fs,
        manifestRepo,
        new CapturingLogger(),
        new UpdateGitignore(fs),
        new Map([[BINARY, activator]]),
        registry,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        new InMemoryManifestRepository(Manifest.create())
      );

      await useCase.execute({ ...AT_PROJECT, force: true });

      expect(activator.removedMarketplaces).toEqual([HOST_NAME]);
      expect(activator.removedMarketplaces).not.toContain(ALIAS);
    });

    describe("the scope Claude asks for a project-owned plugin ref", () => {
      const CLAUDE_REF = "aidd-context@aidd-framework";

      function seedClaudeScopeManifest(
        marketplaces: ReadonlyArray<{ alias: string; hostName: string }>,
        plugins: ReadonlyArray<{ name: string; scope: Scope; marketplace: string }>
      ): Manifest {
        const manifest = Manifest.create();
        manifest.addTool(TOOL.claude, "1.0.0", []);
        for (const plugin of plugins) {
          manifest.addPlugin(
            TOOL.claude,
            InstalledPlugin.fromMetadata(
              plugin.name,
              "1.0.0",
              { kind: "github", repo: "ai-driven-dev/framework" },
              true,
              plugin.scope,
              plugin.marketplace
            )
          );
        }
        manifest.setNativeRegistrations(TOOL.claude, {
          binary: "claude",
          marketplaces: marketplaces.map(({ alias, hostName }) => ({
            alias,
            hostName,
            provenance: { kind: "registry", source: "/some/built/path" },
          })),
          pluginRefs: [CLAUDE_REF],
        });
        return manifest;
      }

      async function uninstallScopesFor(manifest: Manifest): Promise<readonly string[]> {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const activator = new FakeHostActions({
          available: true,
          installedAtScope: new Map([[CLAUDE_REF, "user"]]),
        });
        const useCase = new CleanWithKnownHostSource(
          fs,
          new InMemoryManifestRepository(manifest, PROJECT_ROOT),
          new CapturingLogger(),
          new UpdateGitignore(fs),
          new Map([[TOOL.claude, activator]]),
          seedMarketplaceRegistry()
        );
        await useCase.execute({ ...AT_PROJECT, force: true });
        return activator.uninstalledPluginScopes;
      }

      it("tries the user scope first when that is what the manifest recorded for the plugin behind the ref, found by its own alias among several", async () => {
        const scopes = await uninstallScopesFor(
          seedClaudeScopeManifest(
            [
              { alias: "other", hostName: "other-host" },
              { alias: MARKETPLACE, hostName: MARKETPLACE },
            ],
            [
              { name: "other-plugin", scope: "project", marketplace: MARKETPLACE },
              { name: "aidd-context", scope: "user", marketplace: MARKETPLACE },
            ]
          )
        );

        expect(scopes).toStrictEqual(["user"]);
      });

      it("tries the project scope first when the plugin's alias matches no recorded marketplace", async () => {
        const scopes = await uninstallScopesFor(
          seedClaudeScopeManifest(
            [{ alias: MARKETPLACE, hostName: MARKETPLACE }],
            [{ name: "aidd-context", scope: "user", marketplace: "unknown-alias" }]
          )
        );

        expect(scopes).toStrictEqual(["project", "user"]);
      });

      it("tries the project scope first when the manifest records no plugin at all for the ref", async () => {
        const scopes = await uninstallScopesFor(
          seedClaudeScopeManifest([{ alias: MARKETPLACE, hostName: MARKETPLACE }], [])
        );

        expect(scopes).toStrictEqual(["project", "user"]);
      });
    });

    it("previews no shared-source fact when the references port is wired in but no marketplace registry is", async () => {
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const useCase = new CleanWithKnownHostSource(
        fs,
        new InMemoryManifestRepository(seedManifestWithNativeRegistrations(), PROJECT_ROOT),
        new CapturingLogger(),
        new UpdateGitignore(fs),
        new Map(),
        undefined,
        undefined,
        new Map(),
        () => "/fake-home",
        new UserSourceReferencesAdapter(fs, () => "/fake-home/.config/aidd")
      );

      const result = await useCase.execute({ ...AT_PROJECT, force: false });

      expect(result).toStrictEqual({
        dryRun: true,
        manifestFound: true,
        preview: {
          tools: [{ toolId: TOOL.codex, fileCount: 0 }],
          totalFileCount: 0,
          nativeRegistrations: [
            {
              toolId: TOOL.codex,
              binary: BINARY,
              marketplaceCount: 1,
              pluginRefCount: 1,
              cachePaths: [join("/fake-home", ".codex", "plugins", "cache", MARKETPLACE)],
            },
          ],
          sharedSourceOtherProjects: undefined,
        },
        fileCount: 0,
      });
    });
  });
});
