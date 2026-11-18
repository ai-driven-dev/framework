import { describe, expect, it } from "vitest";
import type {
  RegisterFrameworkMarketplace,
  RegisterFrameworkMarketplaceCommand,
  RegisterFrameworkMarketplaceResult,
} from "../../../src/contexts/distribution/application/register-framework-marketplace.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import { HasherAdapter } from "../../../src/shared/infrastructure/hasher-adapter.js";
import { FakeHostMarketplaceSources } from "../../contexts/host-registration/testing/fake-host-marketplace-sources.js";
import { FakeHostPluginRegistry } from "../../contexts/host-registration/testing/fake-host-plugin-registry.js";
import { marketplaceSync } from "../../helpers/marketplace-sync.js";
import { CapturingLogger } from "../../helpers/ports/capturing-logger.js";
import { FakeCurrentVersion } from "../../helpers/ports/fake-current-version.js";
import { fakeEnsureBuiltMarketplace } from "../../helpers/ports/fake-ensure-built-marketplace.js";
import { InMemoryFileAdapter } from "../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../helpers/ports/in-memory-marketplace-registry.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.js";
import { TOOL } from "../../shared/testing/registered-tools.js";

const { claude } = TOOL;

const PROJECT_ROOT = "/test-project";
const VERSION = "1.0.0";

/** A manifest with Claude installed and no plugin, for both registry and activation checks. */
async function manifestRepoWithClaudeInstalled(): Promise<InMemoryManifestRepository> {
  const manifestRepo = new InMemoryManifestRepository();
  const manifest = Manifest.create();
  manifest.addTool(claude, "test", []);
  await manifestRepo.save(manifest);
  return manifestRepo;
}

function seedFrameworkCatalog(fs: InMemoryFileAdapter): void {
  fs.setFile(
    "/built/claude/.claude-plugin/marketplace.json",
    JSON.stringify({ name: FRAMEWORK_MARKETPLACE_NAME, version: VERSION, plugins: [] })
  );
}

function freshHostProof(activator: FakeHostActions) {
  return {
    pluginRegistries: new Map([
      [claude, new FakeHostPluginRegistry({ location: "/host/plugins.json", refs: new Map() })],
    ]),
    sources: new Map([
      [
        claude,
        new FakeHostMarketplaceSources(
          activator,
          "registry",
          (path) => (path === "/built/claude" ? FRAMEWORK_MARKETPLACE_NAME : undefined),
          new Map()
        ),
      ],
    ]),
  };
}

function frameworkMarketplace(): Marketplace {
  return Marketplace.create({
    name: FRAMEWORK_MARKETPLACE_NAME,
    source: { kind: "local", path: "/shared/built/path" },
    scope: "user",
    addedAt: "2026-01-01T00:00:00.000Z",
  });
}

describe("the shared source's own reference, recorded by sync", () => {
  it("records this project's reference when the framework marketplace is already registered", async () => {
    const fs = new InMemoryFileAdapter({}, new HasherAdapter());
    fs.setFile(`${PROJECT_ROOT}/marker`, "");
    seedFrameworkCatalog(fs);
    const manifestRepo = await manifestRepoWithClaudeInstalled();
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, frameworkMarketplace());
    const userSourceReferences = new UserSourceReferencesAdapter(
      fs,
      () => "/fake-home/.config/aidd"
    );
    const activator = new FakeHostActions({ available: true });
    const proof = freshHostProof(activator);

    const useCase = marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      hasher: new HasherAdapter(),
      logger: new CapturingLogger(),
      activators: new Map([[claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      userSourceReferences,
      currentVersionProvider: new FakeCurrentVersion(VERSION),
      hostPluginRegistries: proof.pluginRegistries,
      nativeSources: proof.sources,
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(await userSourceReferences.listAllReferencingProjects()).toContain(PROJECT_ROOT);
  });

  // `references.json` is a help, not an authority: a corrupted copy must never block `sync`,
  // which does not depend on it.
  it("warns and still completes sync when references.json is corrupted", async () => {
    const fs = new InMemoryFileAdapter({}, new HasherAdapter());
    fs.setFile(`${PROJECT_ROOT}/marker`, "");
    fs.setFile("/fake-home/.config/aidd/references.json", "not json");
    seedFrameworkCatalog(fs);
    const manifestRepo = await manifestRepoWithClaudeInstalled();
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, frameworkMarketplace());
    const userSourceReferences = new UserSourceReferencesAdapter(
      fs,
      () => "/fake-home/.config/aidd"
    );
    const logger = new CapturingLogger();
    const activator = new FakeHostActions({ available: true });
    const proof = freshHostProof(activator);

    const useCase = marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      hasher: new HasherAdapter(),
      logger,
      activators: new Map([[claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      userSourceReferences,
      currentVersionProvider: new FakeCurrentVersion(VERSION),
      hostPluginRegistries: proof.pluginRegistries,
      nativeSources: proof.sources,
    });

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
    });

    expect(result.errors).toEqual([]);
    expect(logger.warnMessages.some((m) => m.includes("references.json"))).toBe(true);
  });

  it("never records a reference to a marketplace registered at project scope", async () => {
    const fs = new InMemoryFileAdapter({}, new HasherAdapter());
    fs.setFile(`${PROJECT_ROOT}/marker`, "");
    const manifestRepo = await manifestRepoWithClaudeInstalled();
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: FRAMEWORK_MARKETPLACE_NAME,
        source: { kind: "local", path: "/project/built/path" },
        scope: "project",
        addedAt: "2026-01-01T00:00:00.000Z",
      })
    );
    const userSourceReferences = new UserSourceReferencesAdapter(
      fs,
      () => "/fake-home/.config/aidd"
    );

    const useCase = marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      hasher: new HasherAdapter(),
      logger: new CapturingLogger(),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      userSourceReferences,
      currentVersionProvider: new FakeCurrentVersion(VERSION),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(await userSourceReferences.listAllReferencingProjects()).not.toContain(PROJECT_ROOT);
  });

  // A clone whose committed manifest predates this machine's own copy of the registry finds
  // `marketplaces` empty, and nothing about a fresh clone ever populates that registry.
  it("recreates the framework marketplace when this machine's registry holds nothing at all", async () => {
    const fs = new InMemoryFileAdapter({}, new HasherAdapter());
    fs.setFile(`${PROJECT_ROOT}/marker`, "");
    seedFrameworkCatalog(fs);
    const manifestRepo = await manifestRepoWithClaudeInstalled();
    const registry = new InMemoryMarketplaceRegistry(); // empty: nothing registered yet
    const userSourceReferences = new UserSourceReferencesAdapter(
      fs,
      () => "/fake-home/.config/aidd"
    );
    const registerFramework: Pick<RegisterFrameworkMarketplace, "execute"> = {
      execute: async (
        options: RegisterFrameworkMarketplaceCommand
      ): Promise<RegisterFrameworkMarketplaceResult> => {
        await registry.save(options.projectRoot, frameworkMarketplace());
        return { registered: true, scope: "user" as const };
      },
    };
    const activator = new FakeHostActions({ available: true });
    const proof = freshHostProof(activator);

    const useCase = marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      hasher: new HasherAdapter(),
      logger: new CapturingLogger(),
      activators: new Map([[claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      marketplaceRegisterFrameworkUseCase: registerFramework,
      userSourceReferences,
      currentVersionProvider: new FakeCurrentVersion(VERSION),
      hostPluginRegistries: proof.pluginRegistries,
      nativeSources: proof.sources,
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      recreateFrameworkIfMissing: true,
    });

    expect((await registry.list(PROJECT_ROOT)).map((m) => m.name)).toContain(
      FRAMEWORK_MARKETPLACE_NAME
    );
    expect(activator.addedMarketplaces).toEqual(["/built/claude"]);
    await useCase.execute({ projectRoot: PROJECT_ROOT });
    expect(await userSourceReferences.listAllReferencingProjects()).toContain(PROJECT_ROOT);
  });

  it("stays a silent no-op when no recreate use case was wired in", async () => {
    const fs = new InMemoryFileAdapter({}, new HasherAdapter());
    const manifestRepo = await manifestRepoWithClaudeInstalled();
    const registry = new InMemoryMarketplaceRegistry();

    const useCase = marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      hasher: new HasherAdapter(),
      logger: new CapturingLogger(),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
    });

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
    });

    expect(result).toEqual({
      activated: [],
      binaryMissing: [],
      warnings: [],
      errors: [],
      failed: false,
    });
  });

  // Every marketplace and plugin command reaches this same `execute`, where an empty registry is
  // a deliberate choice, never a fresh clone: recreating it would undo a `marketplace remove`.
  it("does not recreate the framework marketplace unless the caller asks for it", async () => {
    const fs = new InMemoryFileAdapter({}, new HasherAdapter());
    fs.setFile(`${PROJECT_ROOT}/marker`, "");
    const manifestRepo = await manifestRepoWithClaudeInstalled();
    const registry = new InMemoryMarketplaceRegistry(); // empty, on purpose
    const registerFramework: Pick<RegisterFrameworkMarketplace, "execute"> = {
      execute: async (options: RegisterFrameworkMarketplaceCommand) => {
        await registry.save(options.projectRoot, frameworkMarketplace());
        return { registered: true, scope: "user" as const };
      },
    };

    const useCase = marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      hasher: new HasherAdapter(),
      logger: new CapturingLogger(),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      marketplaceRegisterFrameworkUseCase: registerFramework,
      userSourceReferences: new UserSourceReferencesAdapter(fs, () => "/fake-home/.config/aidd"),
      currentVersionProvider: new FakeCurrentVersion(VERSION),
    });

    // No `recreateFrameworkIfMissing` — the same call shape `syncNativeActivation` uses.
    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(await registry.list(PROJECT_ROOT)).toEqual([]);
  });

  it("stays a silent no-op when asked to recreate with nothing wired to do it", async () => {
    const useCase = marketplaceSync({
      fs: new InMemoryFileAdapter({}, new HasherAdapter()),
      manifestRepo: await manifestRepoWithClaudeInstalled(),
      marketplaceRegistry: new InMemoryMarketplaceRegistry(),
      hasher: new HasherAdapter(),
      logger: new CapturingLogger(),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
    });

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
      recreateFrameworkIfMissing: true,
    });

    expect(result).toStrictEqual({
      activated: [],
      binaryMissing: [],
      warnings: [],
      errors: [],
      failed: false,
    });
  });
});

class UnloadableManifestRepository extends InMemoryManifestRepository {
  override async load(): Promise<Manifest | null> {
    throw new Error("manifest.json is not valid JSON");
  }
}

describe("a project with no manifest to sync", () => {
  it("returns the empty result and drives no tool when there is no manifest", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, frameworkMarketplace());
    const activator = new FakeHostActions({ available: true });
    const useCase = marketplaceSync({
      fs: new InMemoryFileAdapter({}, new HasherAdapter()),
      manifestRepo: new InMemoryManifestRepository(),
      marketplaceRegistry: registry,
      hasher: new HasherAdapter(),
      logger: new CapturingLogger(),
      activators: new Map([[claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
    });

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
    });

    expect(result).toStrictEqual({
      activated: [],
      binaryMissing: [],
      warnings: [],
      errors: [],
      failed: false,
    });
    expect(activator.addedMarketplaces).toStrictEqual([]);
  });

  it("returns the empty result when the manifest cannot be loaded", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, frameworkMarketplace());
    const useCase = marketplaceSync({
      fs: new InMemoryFileAdapter({}, new HasherAdapter()),
      manifestRepo: new UnloadableManifestRepository(),
      marketplaceRegistry: registry,
      hasher: new HasherAdapter(),
      logger: new CapturingLogger(),
      activators: new Map([[claude, new FakeHostActions({ available: true })]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
    });

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
    });

    expect(result).toStrictEqual({
      activated: [],
      binaryMissing: [],
      warnings: [],
      errors: [],
      failed: false,
    });
  });
});
