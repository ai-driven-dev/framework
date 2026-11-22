import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { UserSourceReferences } from "../../../src/contexts/machine-claims/ports/user-source-references.js";
import { FakeHostMarketplaceSources } from "../../contexts/host-registration/testing/fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "../../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeCurrentVersion } from "../../shared/testing/fake-current-version.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  freshHostProof,
  MARKETPLACE,
  manifestWithTool,
  marketplace,
  PROJECT_ROOT,
  seededBuiltCatalog,
} from "../testing/settings-scope.builder.js";

describe("SyncSettings - the activation scope a caller asks for", () => {
  it("enables at project scope by default, never claude's own implicit default", async () => {
    const activator = new FakeHostActions({ available: true });
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const proof = freshHostProof(activator);
    const useCase = marketplaceSync({
      fs: seededBuiltCatalog(),
      manifestRepo: manifestWithTool(),
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      hostPluginRegistries: proof.plugins,
      nativeSources: proof.sources,
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    // No plugin declared here, so nothing to enable: this asserts the marketplace
    // registration path ran at all, and the next test declares one for enablePlugin.
    expect(activator.addedMarketplaces).toHaveLength(1);
  });

  it("passes the user scope down to enablePlugin when the caller asks for it", async () => {
    const activator = new FakeHostActions({ available: true });
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "test", []);
    const { RecordedPlugin } = await import(
      "../../../src/contexts/installation/domain/plugins/recorded-plugin.js"
    );
    manifest.addPlugin(
      TOOL.claude,
      RecordedPlugin.fromMetadata({
        name: "aidd-telemetry",
        version: "1.0.0",
        source: { kind: "github", repo: "ai-driven-dev/framework" },
        strict: true,
        scope: "project",
        marketplace: MARKETPLACE,
      })
    );
    const catalog = new InMemoryFileAdapter(
      {
        "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
          name: MARKETPLACE,
          version: "1.0.0",
          plugins: [{ name: "aidd-telemetry" }],
        }),
      },
      [PROJECT_ROOT]
    );
    const proof = freshHostProof(activator);
    const useCase = marketplaceSync({
      fs: catalog,
      manifestRepo: new InMemoryManifestRepository(manifest),
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      hostPluginRegistries: proof.plugins,
      nativeSources: proof.sources,
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      scope: "user",
    });

    expect(activator.enabledPluginScopes).toEqual(["user"]);
  });

  // A manifest carrying a plugin whose marketplace resolves, so `syncEnabledPluginsFile` has
  // a real entry to write: an empty, no-plugin manifest wrote nothing under either scope.
  async function pluginFixture(): Promise<{
    fs: InMemoryFileAdapter;
    manifestRepo: InMemoryManifestRepository;
  }> {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "test", []);
    const { RecordedPlugin } = await import(
      "../../../src/contexts/installation/domain/plugins/recorded-plugin.js"
    );
    manifest.addPlugin(
      TOOL.claude,
      RecordedPlugin.fromMetadata({
        name: "aidd-telemetry",
        version: "1.0.0",
        source: { kind: "github", repo: "ai-driven-dev/framework" },
        strict: true,
        scope: "project",
        marketplace: MARKETPLACE,
      })
    );
    const fs = new InMemoryFileAdapter(
      {
        "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
          name: MARKETPLACE,
          version: "1.0.0",
          plugins: [{ name: "aidd-telemetry" }],
        }),
      },
      [PROJECT_ROOT]
    );
    return { fs, manifestRepo: new InMemoryManifestRepository(manifest) };
  }

  it("writes no project file at all when the caller asks for user scope - the full project delta, not one named path", async () => {
    const activator = new FakeHostActions({ available: true });
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const { fs, manifestRepo } = await pluginFixture();
    const useCase = marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      scope: "user",
    });

    // resolve(): a project-scope write lands at resolve(projectRoot, settingsPath), which
    // carries a drive letter on win32, so the drive-less literal would prove nothing there.
    expect(fs.listUnder(resolve(PROJECT_ROOT))).toEqual([]);
  });

  it("writes no project file for a plugin the host proved at user scope", async () => {
    const activator = new FakeHostActions({ available: true });
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const manifest = Manifest.create();
    manifest.addTool(TOOL.copilot, "test", []);
    const fs = new InMemoryFileAdapter(
      {
        "/built/copilot/.plugin/marketplace.json": JSON.stringify({
          name: MARKETPLACE,
          version: "1.0.0",
          plugins: [{ name: "aidd-telemetry" }],
        }),
      },
      [PROJECT_ROOT]
    );
    const useCase = marketplaceSync({
      fs,
      manifestRepo: new InMemoryManifestRepository(manifest),
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.copilot, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      hostPluginRegistries: new Map([
        [
          TOOL.copilot,
          new FakeHostPluginRegistry({ location: "/host/settings.json", refs: new Map() }),
        ],
      ]),
      nativeSources: new Map([
        [
          TOOL.copilot,
          new FakeHostMarketplaceSources(
            activator,
            "effective-list",
            (path) => (path === "/built/copilot" ? MARKETPLACE : undefined),
            new Map()
          ),
        ],
      ]),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      scope: "user",
      enablePlugins: ["aidd-telemetry"],
    });

    expect(activator.enabledPluginScopes).toEqual(["user"]);
    expect(fs.listUnder(resolve(PROJECT_ROOT))).toEqual([]);
  });

  it("writes .claude/settings.json for that same fixture at project scope - proof the fixture is not inert", async () => {
    const activator = new FakeHostActions({ available: true });
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const { fs, manifestRepo } = await pluginFixture();
    const useCase = marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    // resolve(): the write carries a drive letter on win32, which a forward-slash template
    // literal never matches.
    const written = await fs.readFile(resolve(PROJECT_ROOT, ".claude", "settings.json"));
    expect(written).toContain("aidd-telemetry");
  });

  it("loads and saves the machine manifest at user scope, never the project's", async () => {
    const activator = new FakeHostActions({ available: true });
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const constructedRepo = manifestWithTool();
    const machineRepo = manifestWithTool();
    const useCase = marketplaceSync({
      fs: seededBuiltCatalog(),
      manifestRepo: constructedRepo,
      userManifestRepo: machineRepo,
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
    });

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
      scope: "user",
    });

    expect(result.activated).toEqual(["claude"]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations(TOOL.claude)).toBeDefined();
    expect(constructedRepo.getCurrent()?.getNativeRegistrations(TOOL.claude)).toBeUndefined();
  });

  it("records no shared-source reference at user scope - no project-scope manifest exists for a later clean to ever decrement it from", async () => {
    const activator = new FakeHostActions({ available: true });
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const added: Array<{ version: string; projectRoot: string }> = [];
    const userSourceReferences: UserSourceReferences = {
      addReference: async (version, projectRoot) => {
        added.push({ version, projectRoot });
      },
      removeReference: async () => undefined,
      listAllReferencingProjects: async () => [],
    };
    const useCase = marketplaceSync({
      fs: seededBuiltCatalog(),
      manifestRepo: manifestWithTool(),
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      userSourceReferences,
      currentVersionProvider: new FakeCurrentVersion(),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      scope: "user",
    });

    expect(added).toEqual([]);
  });

  it("still records a shared-source reference at project scope, unaffected", async () => {
    const activator = new FakeHostActions({ available: true });
    const proof = freshHostProof(activator);
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const added: Array<{ version: string; projectRoot: string }> = [];
    const userSourceReferences: UserSourceReferences = {
      addReference: async (version, projectRoot) => {
        added.push({ version, projectRoot });
      },
      removeReference: async () => undefined,
      listAllReferencingProjects: async () => [],
    };
    const useCase = marketplaceSync({
      fs: seededBuiltCatalog(),
      manifestRepo: manifestWithTool(),
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      userSourceReferences,
      currentVersionProvider: new FakeCurrentVersion(),
      hostPluginRegistries: proof.plugins,
      nativeSources: proof.sources,
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(added).toHaveLength(1);
  });
});
