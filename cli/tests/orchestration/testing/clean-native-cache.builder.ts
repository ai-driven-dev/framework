import { homedir } from "node:os";
import { join } from "node:path";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { HostMarketplaceRegistryReading } from "../../../src/contexts/host-registration/domain/reading/marketplace-registry-reading.js";
import { HostRegistryMarketplaceSourceReaderAdapter } from "../../../src/contexts/host-registration/infrastructure/host-registry-marketplace-source-reader-adapter.js";
import type { HostMarketplaceRegistry } from "../../../src/contexts/host-registration/ports/host-marketplace-registry.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { CleanProject } from "../../../src/orchestration/clean/clean-project.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import type { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { FakeHostPluginRegistry } from "./fake-host-plugin-registry.fake.js";
import { projectCleaner } from "./project-cleaner.builder.js";

export const PROJECT_ROOT = "/test-project";
// Resolve once for this in-memory fixture, then inject it into CleanProject: Stryker reuses
// runners while globalSetup changes HOME, so load-time cache paths and runtime paths must agree.
export const HOME = homedir();
export const CLAUDE_CACHE_ROOT = join(HOME, ".claude", "plugins", "cache");
export const CODEX_CACHE_ROOT = join(HOME, ".codex", "plugins", "cache");
export const EXISTING_DIRECTORIES = [
  PROJECT_ROOT,
  CLAUDE_CACHE_ROOT,
  CODEX_CACHE_ROOT,
  "/outside/evil-target",
];
export const MARKETPLACE = "probe-mkt";
export const REF = "plugin-a@probe-mkt";

/** Codex's current catalogue is a literal host snapshot, not derived from the machine claim. */
export function codexHostSource(): HostMarketplaceSources {
  return {
    read: async () => ({
      location: "fixture Codex effective catalogue",
      entries: new Map(
        ["probe-mkt", "aidd-framework"].map((name) => [
          name,
          {
            kind: "effective-list" as const,
            root: "/some/built/path",
            sourceType: "local",
            source: "/some/built/path",
          },
        ])
      ),
    }),
  };
}

/** Records every `deleteDirectory` call, so a test can prove containment refused one
 * without ever letting it run. */
export class RecordingFileAdapter extends InMemoryFileAdapter {
  readonly deletedDirectories: string[] = [];

  override async deleteDirectory(path: string): Promise<void> {
    this.deletedDirectories.push(path);
    return super.deleteDirectory(path);
  }
}

export class LockTrackingManifestRepository extends InMemoryManifestRepository {
  locked = false;
  lockCalls = 0;

  async withExclusiveAccess<T>(action: () => Promise<T>): Promise<T> {
    this.lockCalls += 1;
    this.locked = true;
    try {
      return await action();
    } finally {
      this.locked = false;
    }
  }
}

export class LockAwareActivator extends FakeHostActions {
  readonly removalsUnderLock: boolean[] = [];

  constructor(private readonly machineRepo: LockTrackingManifestRepository) {
    super({ available: true });
  }

  override removeMarketplace(name: string, scope?: unknown, options?: { force?: boolean }): void {
    this.removalsUnderLock.push(this.machineRepo.locked);
    super.removeMarketplace(name, scope, options);
  }
}

/** Fails `realpath` with a non-ENOENT error (EACCES) for one exact path, so a test can prove
 * `clean` treats that failure like containment - named and skipped - not as an abort. */
export class RealpathDeniedFileAdapter extends RecordingFileAdapter {
  constructor(private readonly deniedPath: string) {
    super();
  }

  override async realpath(path: string): Promise<string> {
    if (path === this.deniedPath) {
      throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    }
    return super.realpath(path);
  }
}

/**
 * Mirrors `activator.removedMarketplaces` at read time rather than answering a canned "gone",
 * which is what proves ordering: a registry read before `removeMarketplace` still sees it.
 */
export class RegistryMirroringActivatorState implements HostMarketplaceRegistry {
  reads = 0;

  constructor(
    private readonly location: string,
    private readonly initialNames: readonly string[],
    private readonly activator: FakeHostActions
  ) {}

  async read(): Promise<HostMarketplaceRegistryReading> {
    this.reads += 1;
    const entries = new Map<string, string>();
    for (const name of this.initialNames) {
      if (!this.activator.removedMarketplaces.includes(name)) {
        entries.set(name, "/resolved/source");
      }
    }
    return { location: this.location, entries };
  }
}

export function seedManifest(toolId: AiToolId, hostName: string, alias: string): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(toolId, "1.0.0", []);
  manifest.setNativeRegistrations(toolId, {
    binary: toolId,
    marketplaces: [
      {
        alias,
        hostName,
        provenance:
          toolId === "claude"
            ? { kind: "registry", source: "/resolved/source" }
            : {
                kind: "effective-list",
                root: "/some/built/path",
                sourceType: "local",
                source: "/some/built/path",
              },
      },
    ],
    pluginRefs: [REF],
  });
  return manifest;
}

export function seedAiddMarketplaceRegistry(alias: string, scope: Scope = "project") {
  const registry = new InMemoryMarketplaceRegistry();
  registry.seed(
    PROJECT_ROOT,
    Marketplace.create({
      name: alias,
      source: { kind: "local", path: "/some/built/path" },
      scope,
      addedAt: "2026-01-01T00:00:00.000Z",
    })
  );
  return registry;
}

export function buildUseCase(deps: {
  fs: InMemoryFileAdapter;
  manifest: Manifest;
  activator: FakeHostActions;
  binary: AiToolId;
  logger: CapturingLogger;
  aiddMarketplaceRegistry: InMemoryMarketplaceRegistry;
  hostMarketplaceRegistries?: ReadonlyMap<AiToolId, HostMarketplaceRegistry>;
  homeDir?: () => string;
  userManifestRepo?: InMemoryManifestRepository;
}): CleanProject {
  const manifestRepo = new InMemoryManifestRepository(deps.manifest, PROJECT_ROOT);
  const claudeHostRegistry = deps.hostMarketplaceRegistries?.get(TOOL.claude);
  const nativeReader: HostMarketplaceSources | undefined =
    deps.binary === "codex"
      ? codexHostSource()
      : deps.binary === "claude" && claudeHostRegistry !== undefined
        ? new HostRegistryMarketplaceSourceReaderAdapter(claudeHostRegistry)
        : undefined;
  return projectCleaner({
    fs: deps.fs,
    manifestRepo,
    logger: deps.logger,
    gitignore: new UpdateGitignore(deps.fs),
    activators: new Map([[deps.binary, deps.activator]]),
    marketplaceRegistry: deps.aiddMarketplaceRegistry,
    marketplaceRegistries: deps.hostMarketplaceRegistries,
    homeDir: deps.homeDir ?? (() => HOME),
    pluginRegistries: new Map([
      [
        deps.binary,
        new FakeHostPluginRegistry({
          location: "fixture host plugin registry",
          refs: new Map(),
        }),
      ],
    ]),
    userManifestRepo: deps.userManifestRepo,
    sources: nativeReader === undefined ? new Map() : new Map([[deps.binary, nativeReader]]),
  });
}
