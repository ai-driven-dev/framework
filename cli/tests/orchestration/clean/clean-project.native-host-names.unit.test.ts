import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
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
  MARKETPLACE,
  PROJECT_ROOT,
  seedManifestWithNativeRegistrations,
  seedMarketplaceRegistry,
} from "../testing/clean-project.builder.js";

describe("clean: native registration host names", () => {
  describe("undoing a host's own native registration", () => {
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
            InstalledPlugin.fromMetadata({
              name: plugin.name,
              version: "1.0.0",
              source: { kind: "github", repo: "ai-driven-dev/framework" },
              strict: true,
              scope: plugin.scope,
              marketplace: plugin.marketplace,
            })
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
