import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { DoctorRegistrationUseCase } from "../../../../../src/contexts/framework/application/doctor/doctor-registration-use-case.js";
import { MarketplaceSyncSettingsUseCase } from "../../../../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import type { EnsureBuiltMarketplace } from "../../../../../src/contexts/framework/application/shared/ensure-built-marketplace-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { buildHostRegistration } from "../../../../../src/contexts/tools/domain/host-plugin-registration.js";
import type {
  HostPluginRegistryReader,
  HostPluginRegistryReading,
} from "../../../../../src/contexts/tools/domain/ports/host-plugin-registry-reader.js";
import { builtMarketplaceDir, userBuiltMarketplaceDir } from "../../../../../src/kernel/paths.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { FakeHostPluginRegistryReader } from "../../../../helpers/ports/fake-host-plugin-registry-reader.js";
import { FakeNativeMarketplaceSourceReader } from "../../../../helpers/ports/fake-native-marketplace-source-reader.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

const PROJECT_ROOT = "/test-project";
const MARKETPLACE = "aidd-framework";
const PLUGIN = "aidd-telemetry";
const REF = `${PLUGIN}@${MARKETPLACE}`;

function marketplace(): Marketplace {
  return Marketplace.create({
    name: MARKETPLACE,
    source: { kind: "github", repo: "ai-driven-dev/framework" },
    scope: "project",
    addedAt: "2026-09-02T00:00:00Z",
  });
}

function manifestWithPlugin(marketplace: string = MARKETPLACE): InMemoryManifestRepository {
  const manifest = Manifest.create();
  manifest.addTool("claude", "test", []);
  manifest.addPlugin(
    "claude",
    InstalledPlugin.fromMetadata(
      PLUGIN,
      "1.0.0",
      { kind: "github", repo: "ai-driven-dev/framework" },
      true,
      "project",
      marketplace
    )
  );
  return new InMemoryManifestRepository(manifest);
}

/** An unreadable built catalog is a hard failure (`UnreadableBuiltCatalogError`), so this
 * fixture must leave a readable one where `fakeEnsureBuiltMarketplace()` resolves "claude". */
function seededBuiltCatalog(): InMemoryFileAdapter {
  return new InMemoryFileAdapter({
    "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
      name: MARKETPLACE,
      version: "1.0.0",
      plugins: [{ name: PLUGIN }],
    }),
  });
}

function readableHostPlugins(refs: readonly string[] = []) {
  return new Map([
    [
      "claude" as const,
      new FakeHostPluginRegistryReader({
        location: "/home/dev/.claude/plugins/installed_plugins.json",
        refs: new Map(refs.map((ref) => [ref, { enabled: true }])),
      }),
    ],
  ]);
}

function nativeSource(
  activator: FakeNativePluginActivator,
  name = MARKETPLACE,
  initial: ReadonlyMap<string, { kind: "registry"; source: string } | null> = new Map()
) {
  return new Map([
    [
      "claude" as const,
      new FakeNativeMarketplaceSourceReader(
        activator,
        "registry",
        (path) => (path === "/built/claude" ? name : undefined),
        initial
      ),
    ],
  ]);
}

function ownedMachineCatalog(hostName: string, source: string): InMemoryManifestRepository {
  const machine = Manifest.create();
  machine.addTool("claude", "test", []);
  machine.setNativeRegistrations("claude", {
    binary: "claude",
    marketplaces: [{ alias: MARKETPLACE, hostName, provenance: { kind: "registry", source } }],
    pluginRefs: [],
    pluginClaims: [],
  });
  return new InMemoryManifestRepository(machine);
}

function buildSync(activator: FakeNativePluginActivator, pluginMarketplace?: string) {
  const registry = new InMemoryMarketplaceRegistry();
  const fs = seededBuiltCatalog();
  const manifestRepo = manifestWithPlugin(pluginMarketplace);
  const hasher = new DeterministicHasher();
  return {
    registry,
    fs,
    manifestRepo,
    hasher,
    useCase: new MarketplaceSyncSettingsUseCase(
      fs,
      manifestRepo,
      registry,
      hasher,
      new CapturingLogger(),
      new Map([["claude", activator]]),
      fakeEnsureBuiltMarketplace(),
      new Map(),
      () => "",
      undefined,
      undefined,
      undefined,
      readableHostPlugins(),
      undefined,
      nativeSource(activator)
    ),
  };
}

const SETTINGS_PATH = ".claude/settings.json";

/** `resolve`, exactly as `syncMarketplacesFile` does: on Windows the production key is
 * `C:\\test-project\\.claude\\settings.json`, which a `/`-joined literal never addresses. */
function settingsPathIn(projectRoot: string): string {
  return resolve(projectRoot, SETTINGS_PATH);
}

/** The host's own CLI writes its `marketplace add` and `plugin enable` results into the very
 * file `syncTool` just hashed. The fake shells out to nothing, so it stands in for that write. */
class ActivatorThatWritesSettings extends FakeNativePluginActivator {
  constructor(
    private readonly fs: InMemoryFileAdapter,
    private readonly settingsAbsolutePath: string
  ) {
    super({ available: true });
  }

  private readonly writes: Promise<void>[] = [];

  async settled(): Promise<void> {
    await Promise.all(this.writes);
  }

  private async appendHostState(): Promise<void> {
    const before = await this.fs.readFile(this.settingsAbsolutePath).catch(() => "{}");
    const json = JSON.parse(before) as Record<string, unknown>;
    // Not a key this code writes: the point is content only the host could have put there.
    json.installedPluginsBookkeeping = { [REF]: { installedAt: "2026-09-05T00:00:00Z" } };
    await this.fs.writeFile(this.settingsAbsolutePath, JSON.stringify(json, null, 2));
  }

  override addMarketplace(source: string): void {
    super.addMarketplace(source);
    this.writes.push(this.appendHostState());
  }

  override enablePlugin(pluginRef: string): void {
    super.enablePlugin(pluginRef);
    this.writes.push(this.appendHostState());
  }
}

describe("syncing settings registers the plugin with the host's own CLI", () => {
  it("drives the host CLI with the same ref the diagnostic looks up", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const { useCase, registry } = buildSync(activator);
    await registry.save(PROJECT_ROOT, marketplace());

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.enabledPlugins).toContain(REF);
    const asked = buildHostRegistration([
      {
        tool: "claude",
        plugins: [{ name: PLUGIN, marketplace: MARKETPLACE }],
        reading: { location: "/registry", refs: new Map([[REF, { enabled: true }]]) },
      },
    ]);
    expect(asked.entries[0]?.ref).toBe(activator.enabledPlugins[0]);
  });

  it("registers nothing when the host CLI is not available, and does not fail the sync", async () => {
    const activator = new FakeNativePluginActivator({ available: false });
    const { useCase, registry } = buildSync(activator);
    await registry.save(PROJECT_ROOT, marketplace());

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.enabledPlugins).toEqual([]);
  });

  // `mergeEnabledPlugins` skips a plugin whose marketplace does not resolve with a bare
  // `continue`, so it reaches neither a settings file nor the host CLI.
  it("registers nothing for a plugin whose marketplace does not resolve, and says nothing about it", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const { useCase, registry } = buildSync(activator, "a-marketplace-nobody-added");
    await registry.save(PROJECT_ROOT, marketplace());

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.enabledPlugins).toEqual([]);
    const entry = buildHostRegistration([
      {
        tool: "claude",
        plugins: [{ name: PLUGIN, marketplace: "a-marketplace-nobody-added" }],
        reading: { location: "/registry", refs: new Map() },
      },
    ]).entries[0];

    expect(entry?.answer).toBe("not-registered");
  });
});

describe("nativeRegistrations reflects what the host's own CLI was asked to register", () => {
  it("records binary, marketplaces and pluginRefs after a successful activation", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const { useCase, registry, manifestRepo } = buildSync(activator);
    await registry.save(PROJECT_ROOT, marketplace());

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    const reloaded = await manifestRepo.load();
    expect(reloaded?.getNativeRegistrations("claude")).toEqual({
      binary: "claude",
      marketplaces: [
        {
          alias: MARKETPLACE,
          hostName: MARKETPLACE,
          provenance: { kind: "registry", source: "/built/claude" },
        },
      ],
      pluginRefs: [REF],
    });
  });

  it("records nothing when the host CLI is not available", async () => {
    const activator = new FakeNativePluginActivator({ available: false });
    const { useCase, registry, manifestRepo } = buildSync(activator);
    await registry.save(PROJECT_ROOT, marketplace());

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    const reloaded = await manifestRepo.load();
    expect(reloaded?.getNativeRegistrations("claude")).toBeUndefined();
  });

  it("re-registers through the host CLI when the manifest's record has gone stale", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const { useCase, registry, manifestRepo } = buildSync(activator);
    const staleManifest = await manifestRepo.load();
    staleManifest?.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [
        {
          alias: MARKETPLACE,
          hostName: MARKETPLACE,
          provenance: { kind: "registry", source: "/built/claude" },
        },
      ],
      pluginRefs: [REF],
    });
    if (staleManifest) await manifestRepo.save(staleManifest);
    await registry.save(PROJECT_ROOT, marketplace());

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.enabledPlugins).toContain(REF);
    const reloaded = await manifestRepo.load();
    expect(reloaded?.getNativeRegistrations("claude")).toEqual({
      binary: "claude",
      marketplaces: [
        {
          alias: MARKETPLACE,
          hostName: MARKETPLACE,
          provenance: { kind: "registry", source: "/built/claude" },
        },
      ],
      pluginRefs: [REF],
    });
  });

  // This project's local alias for a marketplace is free to differ from the name its catalog
  // declares, and `claude` only ever knows the marketplace by the catalog's own name.
  it("drives the host CLI and records the catalog's own name when this project's local alias differs from it", async () => {
    const CATALOG_NAME = "aidd-framework-catalog";
    const activator = new FakeNativePluginActivator({ available: true });
    const registry = new InMemoryMarketplaceRegistry();
    const fs = new InMemoryFileAdapter({
      "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
        name: CATALOG_NAME,
        version: "1.0.0",
        plugins: [],
      }),
    });
    const manifestRepo = manifestWithPlugin();
    const hasher = new DeterministicHasher();
    const useCase = new MarketplaceSyncSettingsUseCase(
      fs,
      manifestRepo,
      registry,
      hasher,
      new CapturingLogger(),
      new Map([["claude", activator]]),
      fakeEnsureBuiltMarketplace(),
      new Map(),
      () => "",
      undefined,
      undefined,
      undefined,
      readableHostPlugins(),
      undefined,
      nativeSource(activator, CATALOG_NAME)
    );
    await registry.save(PROJECT_ROOT, marketplace());

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.enabledPlugins).toEqual([`${PLUGIN}@${CATALOG_NAME}`]);
    expect(activator.enabledPlugins).not.toContain(REF);
    const reloaded = await manifestRepo.load();
    expect(reloaded?.getNativeRegistrations("claude")).toEqual({
      binary: "claude",
      marketplaces: [
        {
          alias: MARKETPLACE,
          hostName: CATALOG_NAME,
          provenance: { kind: "registry", source: "/built/claude" },
        },
      ],
      pluginRefs: [`${PLUGIN}@${CATALOG_NAME}`],
    });
  });
});

// `buildSync` always installs a plugin, so a guard `if (refs.length === 0) return false;` at the
// top of `activateTool` would still pass every other test in this file.
describe("registering a marketplace does not wait for a plugin to point at it", () => {
  it("registers every known marketplace even when the manifest declares no plugin", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const registry = new InMemoryMarketplaceRegistry();
    const fs = seededBuiltCatalog();
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    const manifestRepo = new InMemoryManifestRepository(manifest);
    const hasher = new DeterministicHasher();
    const useCase = new MarketplaceSyncSettingsUseCase(
      fs,
      manifestRepo,
      registry,
      hasher,
      new CapturingLogger(),
      new Map([["claude", activator]]),
      fakeEnsureBuiltMarketplace(),
      new Map(),
      () => "",
      undefined,
      undefined,
      undefined,
      readableHostPlugins(),
      undefined,
      nativeSource(activator)
    );
    await registry.save(PROJECT_ROOT, marketplace());

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.addedMarketplaces).not.toEqual([]);
  });
});

// Claude Code declares one `settingsPath` for both marketplaces and enabled plugins, so the
// host's own CLI writes into the very file `syncTool` hashed just before activation ran.
describe("what native activation leaves behind is not reported as the user's drift", () => {
  it("tracks a hash that still matches the settings file after the host CLI has written to it", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    const fs = seededBuiltCatalog();
    const manifestRepo = manifestWithPlugin();
    const hasher = new DeterministicHasher();
    const settingsAbsolutePath = settingsPathIn(PROJECT_ROOT);
    const activator = new ActivatorThatWritesSettings(fs, settingsAbsolutePath);
    const useCase = new MarketplaceSyncSettingsUseCase(
      fs,
      manifestRepo,
      registry,
      hasher,
      new CapturingLogger(),
      new Map([["claude", activator]]),
      fakeEnsureBuiltMarketplace(),
      new Map(),
      () => "",
      undefined,
      undefined,
      undefined,
      readableHostPlugins(),
      undefined,
      nativeSource(activator)
    );
    await registry.save(PROJECT_ROOT, marketplace());

    await useCase.execute({ projectRoot: PROJECT_ROOT });
    // The port is synchronous and the host CLI's write is not, so let the writes the
    // activator queued actually land before reading the file back.
    await activator.settled();

    const onDisk = await fs.readFile(settingsAbsolutePath);
    const manifest = await manifestRepo.load();
    const tracked = manifest?.getToolFiles("claude") ?? [];
    const entry = tracked.find((file) => file.relativePath === SETTINGS_PATH);

    expect(entry, "the settings file is tracked at all").toBeDefined();
    expect(entry?.hash).toEqual(hasher.hash(onDisk));
  });
  // A tool whose CLI is not on the PATH wrote nothing, so a settings file differing from its
  // tracked hash differs because a person changed it — re-hashing would bless that as ours.
  it("leaves a hash alone for a tool whose own CLI never ran", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    const fs = new InMemoryFileAdapter();
    const manifestRepo = manifestWithPlugin();
    const hasher = new DeterministicHasher();
    const settingsAbsolutePath = settingsPathIn(PROJECT_ROOT);
    const useCase = new MarketplaceSyncSettingsUseCase(
      fs,
      manifestRepo,
      registry,
      hasher,
      new CapturingLogger(),
      // Not available: the binary is not on the PATH, so nothing of the host's is written.
      new Map([["claude", new FakeNativePluginActivator({ available: false })]]),
      fakeEnsureBuiltMarketplace()
    );
    await registry.save(PROJECT_ROOT, marketplace());
    await useCase.execute({ projectRoot: PROJECT_ROOT });
    const hashAfterSync = (await manifestRepo.load())
      ?.getToolFiles("claude")
      .find((file) => file.relativePath === SETTINGS_PATH)?.hash;

    const edited = `${await fs.readFile(settingsAbsolutePath)}\n`;
    await fs.writeFile(settingsAbsolutePath, edited);
    await useCase.execute({ projectRoot: PROJECT_ROOT });

    const tracked = (await manifestRepo.load())
      ?.getToolFiles("claude")
      .find((file) => file.relativePath === SETTINGS_PATH);
    expect(hashAfterSync, "the settings file is tracked at all").toBeDefined();
    expect(tracked?.hash).toEqual(hashAfterSync);
    expect(tracked?.hash).not.toEqual(hasher.hash(edited));
  });
});

// Asking about the local alias would answer "dead" for a registration the host holds live under
// the catalog's own name, and then force-remove a name the host never held.
describe("reclaiming a dead registration asks and acts on the host's own name", () => {
  it("checks and removes the catalog's own name, not this project's local alias, before re-adding", async () => {
    const CATALOG_NAME = "aidd-framework-catalog";
    const activator = new FakeNativePluginActivator({
      available: true,
      conflictOnAdd: true,
      registrationState: "dead",
    });
    const registry = new InMemoryMarketplaceRegistry();
    const fs = new InMemoryFileAdapter({
      "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
        name: CATALOG_NAME,
        version: "1.0.0",
        plugins: [],
      }),
    });
    const manifestRepo = manifestWithPlugin();
    const hasher = new DeterministicHasher();
    const useCase = new MarketplaceSyncSettingsUseCase(
      fs,
      manifestRepo,
      registry,
      hasher,
      new CapturingLogger(),
      new Map([["claude", activator]]),
      fakeEnsureBuiltMarketplace(),
      new Map([
        [
          "claude",
          {
            read: async () => ({
              location: "/home/.claude/plugins/known_marketplaces.json",
              entries: new Map([
                [CATALOG_NAME, builtMarketplaceDir(PROJECT_ROOT, MARKETPLACE, "claude")],
              ]),
            }),
          },
        ],
      ]),
      () => "",
      undefined,
      undefined,
      undefined,
      new Map([["claude", { read: async () => hostReadingOf([]) }]]),
      ownedMachineCatalog(CATALOG_NAME, builtMarketplaceDir(PROJECT_ROOT, MARKETPLACE, "claude")),
      nativeSource(
        activator,
        CATALOG_NAME,
        new Map([
          [
            CATALOG_NAME,
            { kind: "registry", source: builtMarketplaceDir(PROJECT_ROOT, MARKETPLACE, "claude") },
          ],
        ])
      )
    );
    await registry.save(PROJECT_ROOT, marketplace());

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.removedMarketplaces).toEqual([CATALOG_NAME]);
    expect(activator.removedMarketplaces).not.toContain(MARKETPLACE);
    // The reclaim's second `addMarketplace` succeeded once `removedMarketplaces` was
    // non-empty (the fake's own `conflictOnAdd` bypass), so activation still finished.
    expect(activator.addedMarketplaces).not.toEqual([]);
  });
});

// One activator double stands in for the host CLI both `doctor` and `sync` look at, so health
// is read from the state sync was asked to write, not from two doubles agreeing by construction.
describe("what doctor tells a person to run becomes true once sync has run", () => {
  /** Answers `read()` from the activator's own recorded state, so a registry reading
   * always reflects exactly what the last `execute()` asked the host CLI to enable. */
  class RegistryBoundToActivator implements HostPluginRegistryReader {
    constructor(private readonly activator: FakeNativePluginActivator) {}

    async read(): Promise<HostPluginRegistryReading> {
      return {
        location: "/home/dev/.claude/plugins/installed_plugins.json",
        refs: new Map(this.activator.enabledPlugins.map((ref) => [ref, { enabled: true }])),
      };
    }
  }

  it("goes from `aidd sync` to healthy after sync re-registers", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const { useCase, registry, manifestRepo, fs } = buildSync(activator);
    await registry.save(PROJECT_ROOT, marketplace());
    const doctorRegistration = new DoctorRegistrationUseCase(
      fs,
      registry,
      new Map([["claude", activator]]),
      new Map([["claude", new RegistryBoundToActivator(activator)]]),
      new Map(),
      () => "/user-cache",
      { get: () => "1.0.0" }
    );
    // `MarketplaceSyncSettingsUseCase.execute` mutates the loaded manifest in place, so one
    // load kept across both doctor calls sees the sync that runs in between.
    const manifest = await manifestRepo.load();
    expect(manifest, "buildSync always seeds a manifest").not.toBeNull();
    if (manifest === null) throw new Error("unreachable — asserted above");

    const before = await doctorRegistration.execute({
      manifest,
      projectRoot: PROJECT_ROOT,
      allowedIds: null,
    });
    expect(
      before.some((issue) => issue.severity === "error" && issue.fix.includes("aidd sync"))
    ).toBe(true);

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    const after = await doctorRegistration.execute({
      manifest,
      projectRoot: PROJECT_ROOT,
      allowedIds: null,
    });
    expect(after.filter((issue) => issue.severity === "error")).toEqual([]);
  });
});

// `recordNativeRegistrations`'s keyed merge applies only to a narrowed run: an unnarrowed one
// replaces the whole entry, or a ref the registry no longer carries is retained forever.
describe("an unnarrowed run replaces the whole recorded entry (lot 9 review C-B1)", () => {
  const LIVE_MARKETPLACE = "market-live";
  const LIVE_PLUGIN = "plugin-live";

  function liveMarketplace(): Marketplace {
    return Marketplace.create({
      name: LIVE_MARKETPLACE,
      source: { kind: "github", repo: "ai-driven-dev/framework" },
      scope: "project",
      addedAt: "2026-09-02T00:00:00Z",
    });
  }

  function buildLiveSync(activator: FakeNativePluginActivator) {
    const registry = new InMemoryMarketplaceRegistry();
    const fs = new InMemoryFileAdapter({
      "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
        name: LIVE_MARKETPLACE,
        version: "1.0.0",
        plugins: [{ name: LIVE_PLUGIN }],
      }),
    });
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    manifest.addPlugin(
      "claude",
      InstalledPlugin.fromMetadata(
        LIVE_PLUGIN,
        "1.0.0",
        { kind: "github", repo: "ai-driven-dev/framework" },
        true,
        "project",
        LIVE_MARKETPLACE
      )
    );
    const manifestRepo = new InMemoryManifestRepository(manifest);
    const hasher = new DeterministicHasher();
    const useCase = new MarketplaceSyncSettingsUseCase(
      fs,
      manifestRepo,
      registry,
      hasher,
      new CapturingLogger(),
      new Map([["claude", activator]]),
      fakeEnsureBuiltMarketplace(),
      new Map(),
      () => "",
      undefined,
      undefined,
      undefined,
      readableHostPlugins(),
      undefined,
      nativeSource(activator, LIVE_MARKETPLACE)
    );
    return { useCase, registry, manifestRepo };
  }

  it("drops a recorded ref whose hostName the registry no longer carries", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const { useCase, registry, manifestRepo } = buildLiveSync(activator);
    await registry.save(PROJECT_ROOT, liveMarketplace());
    const staleManifest = await manifestRepo.load();
    staleManifest?.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [{ alias: "market-dead", hostName: "host-dead" }],
      pluginRefs: ["plugin-dead@host-dead"],
    });
    if (staleManifest) await manifestRepo.save(staleManifest);

    // Unnarrowed — no `marketplaceNames`, the shape `sync` and `setup` both run.
    await useCase.execute({ projectRoot: PROJECT_ROOT });

    const recorded = (await manifestRepo.load())?.getNativeRegistrations("claude");
    expect(recorded?.pluginRefs).not.toContain("plugin-dead@host-dead");
    expect(recorded?.marketplaces).not.toContainEqual({
      alias: "market-dead",
      hostName: "host-dead",
    });
  });
});

// Two of this project's local aliases can resolve to one `hostName`; `retainedMarketplaces`
// filters by alias, so refs must be retained by alias too, never by hostName alone.
describe("a narrowed run preserves another alias's refs at a shared hostName (lot 9 review C-B2)", () => {
  const SHARED_HOST_NAME = "shared-catalog";
  const ALIAS_X = "alias-x";
  const ALIAS_Y = "alias-y";
  const PLUGIN_X = "plugin-x";
  const PLUGIN_Y = "plugin-y";

  function ensureBuiltSharedCatalog(): EnsureBuiltMarketplace {
    return {
      execute: async () => ({
        builtDir: "/built/by-alias/shared",
        version: "test",
        rebuilt: true,
      }),
    };
  }

  function aliasMarketplace(alias: string): Marketplace {
    return Marketplace.create({
      name: alias,
      source: { kind: "github", repo: "ai-driven-dev/framework" },
      scope: "project",
      addedAt: "2026-09-02T00:00:00Z",
    });
  }

  it("keeps the retained alias's own refs after a run narrowed to the other one", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const registry = new InMemoryMarketplaceRegistry();
    const fs = new InMemoryFileAdapter({
      "/built/by-alias/shared/.claude-plugin/marketplace.json": JSON.stringify({
        name: SHARED_HOST_NAME,
        version: "1.0.0",
        plugins: [{ name: PLUGIN_X }, { name: PLUGIN_Y }],
      }),
    });
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    manifest.addPlugin(
      "claude",
      InstalledPlugin.fromMetadata(
        PLUGIN_X,
        "1.0.0",
        { kind: "github", repo: "ai-driven-dev/framework" },
        true,
        "project",
        ALIAS_X
      )
    );
    manifest.addPlugin(
      "claude",
      InstalledPlugin.fromMetadata(
        PLUGIN_Y,
        "1.0.0",
        { kind: "github", repo: "ai-driven-dev/framework" },
        true,
        "project",
        ALIAS_Y
      )
    );
    const manifestRepo = new InMemoryManifestRepository(manifest);
    const hasher = new DeterministicHasher();
    const useCase = new MarketplaceSyncSettingsUseCase(
      fs,
      manifestRepo,
      registry,
      hasher,
      new CapturingLogger(),
      new Map([["claude", activator]]),
      ensureBuiltSharedCatalog(),
      new Map(),
      () => "",
      undefined,
      undefined,
      undefined,
      readableHostPlugins(),
      undefined,
      new Map([
        [
          "claude",
          new FakeNativeMarketplaceSourceReader(
            activator,
            "registry",
            (path) => (path === "/built/by-alias/shared" ? SHARED_HOST_NAME : undefined),
            new Map()
          ),
        ],
      ])
    );
    await registry.save(PROJECT_ROOT, aliasMarketplace(ALIAS_X));
    await registry.save(PROJECT_ROOT, aliasMarketplace(ALIAS_Y));

    await useCase.execute({ projectRoot: PROJECT_ROOT });
    const beforeNarrow = (await manifestRepo.load())?.getNativeRegistrations("claude");
    expect(beforeNarrow?.pluginRefs, "both refs recorded before the narrowed run").toEqual(
      expect.arrayContaining([`${PLUGIN_X}@${SHARED_HOST_NAME}`, `${PLUGIN_Y}@${SHARED_HOST_NAME}`])
    );

    await useCase.execute({ projectRoot: PROJECT_ROOT, marketplaceNames: [ALIAS_X] });

    const recorded = (await manifestRepo.load())?.getNativeRegistrations("claude");
    expect(recorded?.pluginRefs).toContain(`${PLUGIN_Y}@${SHARED_HOST_NAME}`);
    expect(recorded?.marketplaces).toContainEqual({
      alias: ALIAS_Y,
      hostName: SHARED_HOST_NAME,
      provenance: { kind: "registry", source: "/built/by-alias/shared" },
    });
  });
});

describe("what reclaiming a dead registration says", () => {
  const CATALOG_NAME = "aidd-framework-catalog";
  const RECLAIM =
    "Marketplace 'aidd-framework-catalog' was registered to a directory that no longer exists; re-registering it for this project. Plugins installed from it are removed and the ones this CLI manages are put back.";

  function reclaimSync(
    activator: FakeNativePluginActivator,
    hostSource = builtMarketplaceDir(PROJECT_ROOT, MARKETPLACE, "claude"),
    userRoot = ""
  ) {
    const registry = new InMemoryMarketplaceRegistry();
    class UserRootThatCannotResolve extends InMemoryFileAdapter {
      override async realpath(path: string): Promise<string> {
        if (userRoot !== "" && path === userRoot) throw new Error("ENOENT: user cache is absent");
        return super.realpath(path);
      }
    }
    const fs = new UserRootThatCannotResolve({
      "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
        name: CATALOG_NAME,
        version: "1.0.0",
        plugins: [],
      }),
      "/foreign/cache/marker": "foreign bytes",
    });
    const logger = new CapturingLogger();
    const useCase = new MarketplaceSyncSettingsUseCase(
      fs,
      manifestWithPlugin(),
      registry,
      new DeterministicHasher(),
      logger,
      new Map([["claude", activator]]),
      fakeEnsureBuiltMarketplace(),
      new Map([
        [
          "claude",
          {
            read: async () => ({
              location: "/home/.claude/plugins/known_marketplaces.json",
              entries: new Map([[CATALOG_NAME, hostSource]]),
            }),
          },
        ],
      ]),
      () => userRoot,
      undefined,
      undefined,
      undefined,
      new Map([["claude", { read: async () => hostReadingOf([]) }]]),
      ownedMachineCatalog(
        CATALOG_NAME,
        hostSource === "/foreign/cache"
          ? builtMarketplaceDir(PROJECT_ROOT, MARKETPLACE, "claude")
          : hostSource
      ),
      nativeSource(
        activator,
        CATALOG_NAME,
        new Map([[CATALOG_NAME, { kind: "registry", source: hostSource }]])
      )
    );
    return { useCase, registry, logger, fs };
  }

  it("leaves a foreign host source and its cache untouched even with a past AIDD claim", async () => {
    const activator = new FakeNativePluginActivator({
      available: true,
      conflictOnAdd: true,
      registrationState: "dead",
    });
    const { useCase, registry, fs } = reclaimSync(activator, "/foreign/cache");
    await registry.save(PROJECT_ROOT, marketplace());

    const result = await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(result.warnings.join("\n")).toContain(
      "current host source differs from AIDD's recorded source"
    );
    expect(activator.removedMarketplaces).toEqual([]);
    expect(activator.forcedRemovals).toEqual([]);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(await fs.readFile("/foreign/cache/marker")).toBe("foreign bytes");
  });

  it("does not force-remove a live registration even when its source is proven", async () => {
    const activator = new FakeNativePluginActivator({
      available: true,
      conflictOnAdd: true,
      registrationState: "live",
    });
    const { useCase, registry } = reclaimSync(activator);
    await registry.save(PROJECT_ROOT, marketplace());

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.removedMarketplaces).toEqual([]);
    expect(activator.forcedRemovals).toEqual([]);
    expect(activator.addedMarketplaces).toEqual([]);
  });

  it("reclaims a dead registration from an exact AIDD shared user-cache source", async () => {
    const activator = new FakeNativePluginActivator({
      available: true,
      conflictOnAdd: true,
      registrationState: "dead",
    });
    const userRoot = "/home/aidd";
    const source = userBuiltMarketplaceDir(userRoot, "1.0.0", MARKETPLACE, "claude");
    const { useCase, registry } = reclaimSync(activator, source, userRoot);
    await registry.save(PROJECT_ROOT, marketplace());

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.removedMarketplaces).toEqual([CATALOG_NAME]);
    expect(activator.forcedRemovals).toEqual([true]);
    expect(activator.addedMarketplaces).toEqual(["/built/claude"]);
  });

  it("names the vanished directory's own registration in the one warning it gives", async () => {
    const activator = new FakeNativePluginActivator({
      available: true,
      conflictOnAdd: true,
      registrationState: "dead",
    });
    const { useCase, registry, logger } = reclaimSync(activator);
    await registry.save(PROJECT_ROOT, marketplace());

    const result = await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(result.warnings).toStrictEqual([RECLAIM]);
    expect(logger.warnMessages).toStrictEqual([RECLAIM]);
  });

  it("warns for each reclaim step the host's CLI refused, naming the step and the reason", async () => {
    const activator = new FakeNativePluginActivator({
      available: true,
      conflictOnAdd: true,
      throwOnRemove: true,
      registrationState: "dead",
    });
    const { useCase, registry } = reclaimSync(activator);
    await registry.save(PROJECT_ROOT, marketplace());

    const result = await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(result.warnings).toStrictEqual([
      RECLAIM,
      "Native plugin activation — unregister stale marketplace 'aidd-framework-catalog' skipped: marketplace remove aidd-framework-catalog failed: 'aidd-framework-catalog' is not configured or installed",
    ]);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(result.errors).toStrictEqual([]);
  });
});

function hostReadingOf(refs: readonly string[], enabled = true): HostPluginRegistryReading {
  return {
    location: "/home/dev/.claude/plugins/installed_plugins.json",
    refs: new Map(refs.map((ref) => [ref, { enabled }])),
  };
}

function buildSyncReadingHost(
  activator: FakeNativePluginActivator,
  hostRegistry: HostPluginRegistryReader,
  catalogOwned = false
) {
  const registry = new InMemoryMarketplaceRegistry();
  const manifestRepo = manifestWithPlugin();
  const logger = new CapturingLogger();
  const machine = catalogOwned ? Manifest.create() : undefined;
  if (machine !== undefined) {
    machine.addTool("claude", "test", []);
    machine.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [
        {
          alias: MARKETPLACE,
          hostName: MARKETPLACE,
          provenance: { kind: "registry", source: "/built/claude" },
        },
      ],
      pluginRefs: [],
      pluginClaims: [],
    });
  }
  const useCase = new MarketplaceSyncSettingsUseCase(
    seededBuiltCatalog(),
    manifestRepo,
    registry,
    new DeterministicHasher(),
    logger,
    new Map([["claude", activator]]),
    fakeEnsureBuiltMarketplace(),
    new Map(),
    () => "",
    undefined,
    undefined,
    undefined,
    new Map([["claude", hostRegistry]]),
    machine === undefined ? undefined : new InMemoryManifestRepository(machine),
    nativeSource(
      activator,
      MARKETPLACE,
      catalogOwned
        ? new Map([[MARKETPLACE, { kind: "registry", source: "/built/claude" }]])
        : new Map()
    )
  );
  return { useCase, registry, manifestRepo, logger };
}

describe("a ref the host had enabled before this project asked belongs to the person", () => {
  it("is neither enabled again nor recorded, so clean has nothing of it to undo", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const { useCase, registry, manifestRepo, logger } = buildSyncReadingHost(activator, {
      read: async () => hostReadingOf([REF]),
    });
    await registry.save(PROJECT_ROOT, marketplace());

    const result = await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.enabledPlugins).toEqual([]);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(result.warnings.join("\n")).toContain(`foreign host ref '${REF}'`);
    expect(logger.warnMessages).toEqual(result.warnings);
    const recorded = (await manifestRepo.load())?.getNativeRegistrations("claude");
    expect(recorded?.pluginRefs).toEqual([]);
  });

  it("stays this project's own on the next sync, once the host reports the enable it made", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const { useCase, registry, manifestRepo } = buildSyncReadingHost(
      activator,
      {
        read: async () => hostReadingOf(activator.enabledPlugins),
      },
      true
    );
    await registry.save(PROJECT_ROOT, marketplace());

    await useCase.execute({ projectRoot: PROJECT_ROOT });
    await useCase.execute({ projectRoot: PROJECT_ROOT });

    const recorded = (await manifestRepo.load())?.getNativeRegistrations("claude");
    expect(recorded?.pluginRefs).toEqual([REF]);
  });

  it.each([
    [
      "cannot be read",
      { location: "/home/dev/.claude/plugins/installed_plugins.json", unreadable: "ENOENT" },
    ],
    ["lists it disabled", hostReadingOf([REF], false)],
  ])("refuses to claim a ref when the host registry %s", async (_case, reading) => {
    const activator = new FakeNativePluginActivator({ available: true });
    const { useCase, registry, manifestRepo } = buildSyncReadingHost(activator, {
      read: async () => reading,
    });
    await registry.save(PROJECT_ROOT, marketplace());

    const result = await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.enabledPlugins).toEqual([]);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(result.warnings.some((warning) => warning.includes("registration left untouched"))).toBe(
      true
    );
    const recorded = (await manifestRepo.load())?.getNativeRegistrations("claude");
    expect(recorded?.pluginRefs).toEqual([]);
  });
});
