import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.use-case.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
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

const homedir = (): string => "/home/dev";

describe("clean: native registration undo order", () => {
  describe("undoing a host's own native registration", () => {
    describe("uninstalling at the scope a plugin was actually registered at", () => {
      const CLAUDE_BINARY = "claude";
      const CLAUDE_MARKETPLACE = "aidd-framework";
      const CLAUDE_REF = "aidd-context@aidd-framework";

      function seedClaudeManifest(pluginScope: Scope): Manifest {
        const manifest = Manifest.create();
        manifest.addTool(TOOL.claude, "1.0.0", []);
        manifest.addPlugin(
          TOOL.claude,
          InstalledPlugin.fromMetadata({
            name: "aidd-context",
            version: "1.0.0",
            source: { kind: "github", repo: "ai-driven-dev/framework" },
            strict: true,
            scope: pluginScope,
            marketplace: CLAUDE_MARKETPLACE,
          })
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
        registry.seed(
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
  });
});
