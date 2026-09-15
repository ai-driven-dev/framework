/**
 * The two measured leftovers this covers: `claude` leaves the built tree in full, marked
 * `.orphaned_at`; `codex` deletes a marketplace's content but leaves the empty shell behind.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
// hostMarketplaceRegistryReaders (used by the HOME-parity test below) iterates every
// AI_TOOL_IDS entry, so every profile must be registered here too.
import "../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { Marketplace } from "../../../../src/contexts/distribution/domain/marketplace.js";
import { CleanUseCase } from "../../../../src/contexts/framework/application/clean-use-case.js";
import { GitignoreUseCase } from "../../../../src/contexts/framework/application/gitignore-use-case.js";
import { Manifest } from "../../../../src/contexts/framework/domain/manifest.js";
import type {
  HostMarketplaceRegistryReader,
  HostMarketplaceRegistryReading,
} from "../../../../src/contexts/tools/domain/ports/host-marketplace-registry-reader.js";
import { hostMarketplaceRegistryReaders } from "../../../../src/contexts/tools/infrastructure/host-marketplace-registry-reader-adapter.js";
import { AIDD_DIR } from "../../../../src/kernel/paths.js";
import type { AiToolId } from "../../../../src/kernel/tool.js";
import { CapturingLogger } from "../../../helpers/ports/capturing-logger.js";
import { FakeHostMarketplaceRegistryReader } from "../../../helpers/ports/fake-host-marketplace-registry-reader.js";
import { FakeNativePluginActivator } from "../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../helpers/ports/in-memory-marketplace-registry.js";

const PROJECT_ROOT = "/test-project";
// Resolve once for this in-memory fixture, then inject it into CleanUseCase: Stryker reuses
// runners while globalSetup changes HOME, so load-time cache paths and runtime paths must agree.
const HOME = homedir();
const CLAUDE_CACHE_ROOT = join(HOME, ".claude", "plugins", "cache");
const CODEX_CACHE_ROOT = join(HOME, ".codex", "plugins", "cache");
const MARKETPLACE = "probe-mkt";
const REF = "plugin-a@probe-mkt";

/** Records every `deleteDirectory` call, so a test can prove containment refused one
 * without ever letting it run. */
class RecordingFileAdapter extends InMemoryFileAdapter {
  readonly deletedDirectories: string[] = [];

  override async deleteDirectory(path: string): Promise<void> {
    this.deletedDirectories.push(path);
    return super.deleteDirectory(path);
  }
}

/** In-memory files have implicit directories; expose one real empty cache directory to prove
 * a skipped host unregister cannot still make clean delete its cache shell. */
class EmptyNativeCacheFileAdapter extends RecordingFileAdapter {
  constructor(private readonly emptyCacheDir: string) {
    super();
  }

  override async fileExists(path: string): Promise<boolean> {
    return path === this.emptyCacheDir || super.fileExists(path);
  }

  override async listDirectory(path: string): Promise<string[]> {
    return path === this.emptyCacheDir ? [] : super.listDirectory(path);
  }
}

class LockTrackingManifestRepository extends InMemoryManifestRepository {
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

class LockAwareActivator extends FakeNativePluginActivator {
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
 * `clean` treats that failure like containment — named and skipped — not as an abort. */
class RealpathDeniedFileAdapter extends RecordingFileAdapter {
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
class RegistryMirroringActivatorState implements HostMarketplaceRegistryReader {
  reads = 0;

  constructor(
    private readonly location: string,
    private readonly initialNames: readonly string[],
    private readonly activator: FakeNativePluginActivator
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

function seedManifest(toolId: "claude" | "codex", hostName: string, alias: string): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(toolId, "1.0.0", []);
  manifest.setNativeRegistrations(toolId, {
    binary: toolId,
    marketplaces: [{ alias, hostName }],
    pluginRefs: [REF],
  });
  return manifest;
}

function seedAiddMarketplaceRegistry(alias: string): InMemoryMarketplaceRegistry {
  const registry = new InMemoryMarketplaceRegistry();
  registry.save(
    PROJECT_ROOT,
    Marketplace.create({
      name: alias,
      source: { kind: "local", path: "/some/built/path" },
      scope: "project",
      addedAt: "2026-01-01T00:00:00.000Z",
    })
  );
  return registry;
}

function buildUseCase(deps: {
  fs: InMemoryFileAdapter;
  manifest: Manifest;
  activator: FakeNativePluginActivator;
  binary: string;
  logger: CapturingLogger;
  aiddMarketplaceRegistry: InMemoryMarketplaceRegistry;
  hostMarketplaceRegistries?: ReadonlyMap<AiToolId, HostMarketplaceRegistryReader>;
  homeDir?: () => string;
  userManifestRepo?: InMemoryManifestRepository;
}): CleanUseCase {
  const manifestRepo = new InMemoryManifestRepository(deps.manifest, PROJECT_ROOT);
  return new CleanUseCase(
    deps.fs,
    manifestRepo,
    deps.logger,
    new GitignoreUseCase(deps.fs),
    new Map([[deps.binary, deps.activator]]),
    deps.aiddMarketplaceRegistry,
    undefined,
    deps.hostMarketplaceRegistries ?? new Map(),
    deps.homeDir ?? (() => HOME),
    undefined,
    new Map(),
    deps.userManifestRepo
  );
}

describe("clean purges a host's own plugin cache", () => {
  it("project A clean keeps a non-framework Codex catalogue cache and B's exact native claim", async () => {
    const fs = new RecordingFileAdapter();
    const cacheEntry = join(CODEX_CACHE_ROOT, MARKETPLACE, "plugin-a", "1.0.0", "plugin.json");
    fs.setFile(cacheEntry, "B still uses these bytes");
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: MARKETPLACE,
        source: { kind: "local", path: "/source" },
        scope: "user",
        addedAt: "2026-01-01T00:00:00Z",
      })
    );
    const machine = Manifest.create();
    machine.addTool("codex", "1.0.0", []);
    machine.setNativeRegistrations("codex", {
      binary: "codex",
      marketplaces: [{ alias: MARKETPLACE, hostName: MARKETPLACE }],
      pluginRefs: [REF],
      pluginClaims: [{ ref: REF, dependents: [PROJECT_ROOT, "/project-b"] }],
    });
    const userRepo = new InMemoryManifestRepository(machine);
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("codex", MARKETPLACE, MARKETPLACE),
      activator,
      binary: "codex",
      logger,
      aiddMarketplaceRegistry: registry,
      userManifestRepo: userRepo,
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(fs.getFile(cacheEntry)).toBe("B still uses these bytes");
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(userRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/project-b"] },
    ]);
    expect(logger.warnMessages.join("\n")).toContain("Still needed by /project-b");
  });
  it("removes a project-labelled Codex catalogue when machine refs belong only to another host catalogue", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: MARKETPLACE,
        source: { kind: "local", path: "/source" },
        scope: "project",
        addedAt: "2026-01-01T00:00:00Z",
      })
    );
    const machine = Manifest.create();
    machine.addTool("codex", "1.0.0", []);
    machine.setNativeRegistrations("codex", {
      binary: "codex",
      marketplaces: [{ alias: "other-alias", hostName: "other-catalog" }],
      pluginRefs: ["other-plugin@other-catalog"],
      pluginClaims: [{ ref: "other-plugin@other-catalog", dependents: ["/project-b"] }],
    });
    const userRepo = new InMemoryManifestRepository(machine);
    const activator = new FakeNativePluginActivator({ available: true });
    const useCase = buildUseCase({
      fs: new RecordingFileAdapter(),
      manifest: seedManifest("codex", MARKETPLACE, MARKETPLACE),
      activator,
      binary: "codex",
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: registry,
      userManifestRepo: userRepo,
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });
    expect(activator.removedMarketplaces).toEqual([MARKETPLACE]);
    expect(userRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: "other-plugin@other-catalog", dependents: ["/project-b"] },
    ]);
  });
  it("holds the machine lock through native catalogue removal after checking its claims", async () => {
    const project = Manifest.create();
    project.addTool("codex", "1.0.0", []);
    project.setNativeRegistrations("codex", {
      binary: "codex",
      marketplaces: [{ alias: MARKETPLACE, hostName: MARKETPLACE }],
      pluginRefs: [],
    });
    const machine = Manifest.create();
    machine.addTool("codex", "1.0.0", []);
    const userRepo = new LockTrackingManifestRepository(machine);
    const activator = new LockAwareActivator(userRepo);
    const useCase = buildUseCase({
      fs: new RecordingFileAdapter(),
      manifest: project,
      activator,
      binary: "codex",
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      userManifestRepo: userRepo,
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });
    expect(activator.removedMarketplaces).toEqual([MARKETPLACE]);
    expect(activator.removalsUnderLock).toEqual([true]);
    expect(userRepo.lockCalls).toBe(1);
    expect(userRepo.locked).toBe(false);
  });
  it("leaves a project-labelled machine-global catalogue when no user manifest can prove it unshared", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: MARKETPLACE,
        source: { kind: "local", path: "/source" },
        scope: "project",
        addedAt: "2026-01-01T00:00:00Z",
      })
    );
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const emptyCache = join(CODEX_CACHE_ROOT, MARKETPLACE);
    const fs = new EmptyNativeCacheFileAdapter(emptyCache);
    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("codex", MARKETPLACE, MARKETPLACE),
      activator,
      binary: "codex",
      logger,
      aiddMarketplaceRegistry: registry,
      userManifestRepo: new InMemoryManifestRepository(),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });
    expect(activator.removedMarketplaces).toEqual([]);
    expect(fs.deletedDirectories).not.toContain(emptyCache);
    expect(logger.warnMessages.join("\n")).toContain(
      "no user manifest can prove no other project still uses it"
    );

    const noRepoActivator = new FakeNativePluginActivator({ available: true });
    const noRepoLogger = new CapturingLogger();
    const noRepoFs = new EmptyNativeCacheFileAdapter(emptyCache);
    const noRepoUseCase = buildUseCase({
      fs: noRepoFs,
      manifest: seedManifest("codex", MARKETPLACE, MARKETPLACE),
      activator: noRepoActivator,
      binary: "codex",
      logger: noRepoLogger,
      aiddMarketplaceRegistry: registry,
    });
    await noRepoUseCase.execute({ projectRoot: PROJECT_ROOT, force: true });
    expect(noRepoActivator.removedMarketplaces).toEqual([]);
    expect(noRepoFs.deletedDirectories).not.toContain(emptyCache);
    expect(noRepoLogger.warnMessages.join("\n")).toContain(
      "no user manifest can prove no other project still uses it"
    );
  });
  it("keeps a project-labelled framework catalogue when B still has an exact native machine claim", async () => {
    const framework = "aidd-framework";
    const ref = `plugin-a@${framework}`;
    const project = seedManifest("codex", framework, framework);
    const projectRegistrations = project.getNativeRegistrations("codex");
    if (projectRegistrations === undefined) throw new Error("fixture missing project native state");
    project.setNativeRegistrations("codex", { ...projectRegistrations, pluginRefs: [ref] });
    const machine = Manifest.create();
    machine.addTool("codex", "1.0.0", []);
    machine.setNativeRegistrations("codex", {
      binary: "codex",
      marketplaces: [{ alias: framework, hostName: framework }],
      pluginRefs: [ref],
      pluginClaims: [{ ref, dependents: [PROJECT_ROOT, "/project-b"] }],
    });
    const userRepo = new InMemoryManifestRepository(machine);
    const activator = new FakeNativePluginActivator({ available: true });
    const useCase = buildUseCase({
      fs: new RecordingFileAdapter(),
      manifest: project,
      activator,
      binary: "codex",
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(framework),
      userManifestRepo: userRepo,
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(userRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref, dependents: ["/project-b"] },
    ]);
  });
  it("project A clean never unregisters a project-labelled Codex catalogue still carrying B's machine ref", async () => {
    const fs = new RecordingFileAdapter();
    const cacheEntry = join(CODEX_CACHE_ROOT, MARKETPLACE, "plugin-a", "1.0.0", "plugin.json");
    fs.setFile(cacheEntry, "B still uses these bytes");
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: MARKETPLACE,
        source: { kind: "local", path: "/source" },
        scope: "project",
        addedAt: "2026-01-01T00:00:00Z",
      })
    );
    const machine = Manifest.create();
    machine.addTool("codex", "1.0.0", []);
    machine.setNativeRegistrations("codex", {
      binary: "codex",
      marketplaces: [],
      pluginRefs: [REF],
      pluginClaims: [{ ref: REF, dependents: [PROJECT_ROOT, "/project-b"] }],
    });
    const userRepo = new InMemoryManifestRepository(machine);
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("codex", MARKETPLACE, MARKETPLACE),
      activator,
      binary: "codex",
      logger,
      aiddMarketplaceRegistry: registry,
      userManifestRepo: userRepo,
    });
    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(fs.getFile(cacheEntry)).toBe("B still uses these bytes");
    expect(userRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/project-b"] },
    ]);
    expect(logger.warnMessages.join("\n")).toContain("Still needed by /project-b");
  });
  it("does not purge B's empty Codex cache shell when a machine claim blocked host unregister", async () => {
    const emptyCache = join(CODEX_CACHE_ROOT, MARKETPLACE);
    const fs = new EmptyNativeCacheFileAdapter(emptyCache);
    const machine = Manifest.create();
    machine.addTool("codex", "1.0.0", []);
    machine.setNativeRegistrations("codex", {
      binary: "codex",
      marketplaces: [],
      pluginRefs: [REF],
      pluginClaims: [{ ref: REF, dependents: [PROJECT_ROOT, "/project-b"] }],
    });
    const userRepo = new InMemoryManifestRepository(machine);
    const activator = new FakeNativePluginActivator({ available: true });
    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("codex", MARKETPLACE, MARKETPLACE),
      activator,
      binary: "codex",
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      userManifestRepo: userRepo,
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });
    expect(activator.removedMarketplaces).toEqual([]);
    expect(fs.deletedDirectories).not.toContain(emptyCache);
    expect(userRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/project-b"] },
    ]);
  });
  it("purges claude's cache once undoing the registration actually frees the name", async () => {
    const fs = new RecordingFileAdapter();
    const cacheEntry = join(CLAUDE_CACHE_ROOT, MARKETPLACE, "plugin-a", "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");
    await fs.writeFile(
      join(CLAUDE_CACHE_ROOT, MARKETPLACE, "plugin-a", "1.0.0", ".orphaned_at"),
      "now"
    );

    const activator = new FakeNativePluginActivator({ available: true });
    const reader = new RegistryMirroringActivatorState(
      "known_marketplaces.json",
      [MARKETPLACE],
      activator
    );
    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("claude", MARKETPLACE, MARKETPLACE),
      activator,
      binary: "claude",
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      hostMarketplaceRegistries: new Map([["claude", reader]]),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(await fs.fileExists(cacheEntry)).toBe(false);
    expect(activator.removedMarketplaces).toContain(MARKETPLACE);
    expect(reader.reads).toBe(1);
  });

  it("leaves claude's cache in place, and names it, when the claude CLI is not on PATH", async () => {
    const fs = new RecordingFileAdapter();
    const cacheEntry = join(CLAUDE_CACHE_ROOT, MARKETPLACE, "plugin-a", "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");

    const activator = new FakeNativePluginActivator({ available: false });
    const reader = new RegistryMirroringActivatorState(
      "known_marketplaces.json",
      [MARKETPLACE],
      activator
    );
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("claude", MARKETPLACE, MARKETPLACE),
      activator,
      binary: "claude",
      logger,
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      hostMarketplaceRegistries: new Map([["claude", reader]]),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(await fs.fileExists(cacheEntry)).toBe(true);
    expect(reader.reads).toBe(0);
    // Not just that the cache survives — the output says where, the same absolute path the
    // dry-run preview would have announced.
    expect(
      logger.warnMessages.some(
        (m) => m.includes("not on the PATH") && m.includes(join(CLAUDE_CACHE_ROOT, MARKETPLACE))
      )
    ).toBe(true);
  });

  it("leaves claude's cache in place without trusting a registry read after host removal fails", async () => {
    // `removeMarketplace` throws (host refused, or the call failed for any other
    // reason `bestEffort` swallows), so the registry mirror never drops the name.
    const fs = new RecordingFileAdapter();
    const cacheEntry = join(CLAUDE_CACHE_ROOT, MARKETPLACE, "plugin-a", "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");

    const activator = new FakeNativePluginActivator({ available: true, throwOnRemove: true });
    const reader = new RegistryMirroringActivatorState(
      "known_marketplaces.json",
      [MARKETPLACE],
      activator
    );
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("claude", MARKETPLACE, MARKETPLACE),
      activator,
      binary: "claude",
      logger,
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      hostMarketplaceRegistries: new Map([["claude", reader]]),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(await fs.fileExists(cacheEntry)).toBe(true);
    expect(reader.reads).toBe(0);
    expect(logger.warnMessages.some((m) => m.includes("removal was not confirmed"))).toBe(true);
  });

  it("purges claude's cache when its registry does not exist at all", async () => {
    const fs = new RecordingFileAdapter();
    const cacheEntry = join(CLAUDE_CACHE_ROOT, MARKETPLACE, "plugin-a", "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");

    const activator = new FakeNativePluginActivator({ available: true });
    const reader = new FakeHostMarketplaceRegistryReader({
      location: "known_marketplaces.json",
      absent: true,
    });
    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("claude", MARKETPLACE, MARKETPLACE),
      activator,
      binary: "claude",
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      hostMarketplaceRegistries: new Map([["claude", reader]]),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(await fs.fileExists(cacheEntry)).toBe(false);
  });

  it("leaves claude's cache in place, and says so, when its registry could not be read", async () => {
    const fs = new RecordingFileAdapter();
    const cacheEntry = join(CLAUDE_CACHE_ROOT, MARKETPLACE, "plugin-a", "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");

    const activator = new FakeNativePluginActivator({ available: true });
    const reader = new FakeHostMarketplaceRegistryReader({
      location: "known_marketplaces.json",
      unreadable: "EACCES",
    });
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("claude", MARKETPLACE, MARKETPLACE),
      activator,
      binary: "claude",
      logger,
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      hostMarketplaceRegistries: new Map([["claude", reader]]),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(await fs.fileExists(cacheEntry)).toBe(true);
    expect(
      logger.warnMessages.some(
        (m) =>
          m.includes("claude: plugin cache left in place, its registry could not be read") &&
          m.includes("known_marketplaces.json")
      )
    ).toBe(true);
  });

  it("purges the cache under the same HOME its own registry reader resolves its file from", async () => {
    // A sentinel, never this machine's real home: a cache root composed from `os.homedir()`
    // directly ignores the injected `homeDir` and looks under the real home instead.
    const SENTINEL_HOME = "/sentinel-home-clean-cache-parity";
    const fs = new RecordingFileAdapter();
    const cacheEntry = join(
      SENTINEL_HOME,
      ".claude",
      "plugins",
      "cache",
      MARKETPLACE,
      "plugin-a",
      "1.0.0",
      "plugin.json"
    );
    await fs.writeFile(cacheEntry, "{}");

    const activator = new FakeNativePluginActivator({ available: true });
    // The real adapter, resolved from the same sentinel the cache root is composed from — a
    // fake reader built independently of `homeDir` could never catch the two halves drifting.
    const reader = hostMarketplaceRegistryReaders(SENTINEL_HOME).get("claude");
    if (reader === undefined) throw new Error("claude must declare marketplaceRegistry");

    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("claude", MARKETPLACE, MARKETPLACE),
      activator,
      binary: "claude",
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      hostMarketplaceRegistries: new Map([["claude", reader]]),
      homeDir: () => SENTINEL_HOME,
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    // The real reader finds no known_marketplaces.json under a sentinel home that does not
    // exist on disk — absent, not unreadable — so purging proves both halves used it.
    expect(await fs.fileExists(cacheEntry)).toBe(false);
  });

  it("refuses a '..' segment in a manifest's own hostName, never consulting the registry", async () => {
    const hostName = "../../../evil";
    const fs = new RecordingFileAdapter();
    const witness = join(CLAUDE_CACHE_ROOT, hostName);
    // Written exactly where an unresolved join lands — so the guard is proven against the
    // collapse `path.join` already performs, not a path this test invents.
    await fs.writeFile(join(witness, "keep-me.txt"), "still here");

    const activator = new FakeNativePluginActivator({ available: true });
    const reader = new RegistryMirroringActivatorState(
      "known_marketplaces.json",
      [hostName],
      activator
    );
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("claude", hostName, "safe-alias"),
      activator,
      binary: "claude",
      logger,
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry("safe-alias"),
      hostMarketplaceRegistries: new Map([["claude", reader]]),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(await fs.fileExists(join(witness, "keep-me.txt"))).toBe(true);
    expect(fs.deletedDirectories).not.toContain(witness);
    expect(reader.reads).toBe(0);
    expect(logger.warnMessages.some((m) => m.includes("does not resolve inside"))).toBe(true);
  });

  it("refuses a cache entry that resolves outside the declared cache root through a symlink", async () => {
    const fs = new RecordingFileAdapter();
    const candidate = join(CLAUDE_CACHE_ROOT, MARKETPLACE);
    fs.setSymlink(candidate, "/outside/evil-target");

    const activator = new FakeNativePluginActivator({ available: true });
    const reader = new RegistryMirroringActivatorState(
      "known_marketplaces.json",
      [MARKETPLACE],
      activator
    );
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("claude", MARKETPLACE, MARKETPLACE),
      activator,
      binary: "claude",
      logger,
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      hostMarketplaceRegistries: new Map([["claude", reader]]),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(fs.deletedDirectories).not.toContain(candidate);
    expect(logger.warnMessages.some((m) => m.includes("does not resolve inside"))).toBe(true);
  });

  it("keeps and names a cache path whose realpath fails with EACCES, without aborting the rest of clean", async () => {
    const candidate = join(CLAUDE_CACHE_ROOT, MARKETPLACE);
    const fs = new RealpathDeniedFileAdapter(candidate);
    const cacheEntry = join(candidate, "plugin-a", "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");

    const activator = new FakeNativePluginActivator({ available: true });
    const reader = new RegistryMirroringActivatorState(
      "known_marketplaces.json",
      [MARKETPLACE],
      activator
    );
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("claude", MARKETPLACE, MARKETPLACE),
      activator,
      binary: "claude",
      logger,
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      hostMarketplaceRegistries: new Map([["claude", reader]]),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(await fs.fileExists(cacheEntry)).toBe(true);
    expect(logger.warnMessages.some((m) => m.includes(candidate))).toBe(true);
    // removeAiddState sits well past the cache purge in execute()'s own order, so its
    // running is what proves nothing aborted mid-course.
    expect(fs.deletedDirectories).toContain(join(PROJECT_ROOT, AIDD_DIR, "cache"));
  });

  it("touches nothing under HOME for a tool whose profile declares no pluginCacheDir", async () => {
    const fs = new RecordingFileAdapter();
    const activator = new FakeNativePluginActivator({ available: true });
    const manifest = Manifest.create();
    manifest.addTool("copilot", "1.0.0", []);
    manifest.setNativeRegistrations("copilot", {
      binary: "copilot",
      marketplaces: [{ alias: MARKETPLACE, hostName: MARKETPLACE }],
      pluginRefs: [REF],
    });
    const useCase = buildUseCase({
      fs,
      manifest,
      activator,
      binary: "copilot",
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(fs.deletedDirectories.some((p) => p.startsWith(HOME))).toBe(false);
  });

  it("purges under the catalog's own hostName, never the project's local alias", async () => {
    const alias = "my-local-alias";
    const hostName = "upstream-catalog-name";
    const fs = new RecordingFileAdapter();
    const cacheEntry = join(CLAUDE_CACHE_ROOT, hostName, "plugin-a", "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");

    const activator = new FakeNativePluginActivator({ available: true });
    const reader = new RegistryMirroringActivatorState(
      "known_marketplaces.json",
      [hostName],
      activator
    );
    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("claude", hostName, alias),
      activator,
      binary: "claude",
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(alias),
      hostMarketplaceRegistries: new Map([["claude", reader]]),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(await fs.fileExists(cacheEntry)).toBe(false);
    expect(fs.deletedDirectories).not.toContain(join(CLAUDE_CACHE_ROOT, alias));
  });

  it("purges codex's empty cache shell once its own CLI has removed the marketplace", async () => {
    // No reader registered for codex — its profile declares `pluginCacheDir` alone, no
    // `marketplaceRegistry`, so `purgeOneMarketplaceCache` proves emptiness instead.
    const fs = new RecordingFileAdapter();
    const activator = new FakeNativePluginActivator({ available: true });
    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("codex", MARKETPLACE, MARKETPLACE),
      activator,
      binary: "codex",
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      userManifestRepo: new InMemoryManifestRepository(Manifest.create()),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(fs.deletedDirectories).toContain(join(CODEX_CACHE_ROOT, MARKETPLACE));
  });

  it("leaves codex's cache in place, even empty, when marketplace removal was not confirmed", async () => {
    // Nothing under the cache directory — the shape `purgeCacheIfEmpty` reads as safe — while
    // `removeMarketplace` throws, so the host was never confirmed to have forgotten the name.
    const fs = new RecordingFileAdapter();

    const activator = new FakeNativePluginActivator({ available: true, throwOnRemove: true });
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("codex", MARKETPLACE, MARKETPLACE),
      activator,
      binary: "codex",
      logger,
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      userManifestRepo: new InMemoryManifestRepository(Manifest.create()),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(fs.deletedDirectories).not.toContain(join(CODEX_CACHE_ROOT, MARKETPLACE));
    expect(logger.warnMessages.some((m) => m.includes("its own removal was not confirmed"))).toBe(
      true
    );
  });

  it("leaves codex's cache in place, and names it, when it still holds content", async () => {
    const fs = new RecordingFileAdapter();
    const leftover = join(CODEX_CACHE_ROOT, MARKETPLACE, "leftover.txt");
    await fs.writeFile(leftover, "still here");

    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      fs,
      manifest: seedManifest("codex", MARKETPLACE, MARKETPLACE),
      activator,
      binary: "codex",
      logger,
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      userManifestRepo: new InMemoryManifestRepository(Manifest.create()),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(await fs.fileExists(leftover)).toBe(true);
    expect(fs.deletedDirectories).not.toContain(join(CODEX_CACHE_ROOT, MARKETPLACE));
    expect(logger.warnMessages.some((m) => m.includes("still holds"))).toBe(true);
  });
});
