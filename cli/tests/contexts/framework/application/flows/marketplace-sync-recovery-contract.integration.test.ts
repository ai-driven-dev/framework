import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { MarketplaceSyncSettingsUseCase } from "../../../../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import type { UserSourceReferences } from "../../../../../src/contexts/framework/domain/ports/user-source-references.js";
import type { HostMarketplaceRegistryReader } from "../../../../../src/contexts/tools/domain/ports/host-marketplace-registry-reader.js";
import type { HostPluginRegistryReading } from "../../../../../src/contexts/tools/domain/ports/host-plugin-registry-reader.js";
import type {
  NativeMarketplaceSource,
  NativeMarketplaceSourceReader,
} from "../../../../../src/contexts/tools/domain/ports/native-marketplace-source-reader.js";
import { NativePluginCliError } from "../../../../../src/kernel/errors.js";
import { InstallationFile } from "../../../../../src/kernel/file.js";
import { builtMarketplaceDir, userBuiltMarketplaceDir } from "../../../../../src/kernel/paths.js";
import type { MarketplaceScope } from "../../../../../src/kernel/scope.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { FakeHostMarketplaceRegistryReader } from "../../../../helpers/ports/fake-host-marketplace-registry-reader.js";
import { FakeNativeMarketplaceSourceReader } from "../../../../helpers/ports/fake-native-marketplace-source-reader.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

const ROOT = "/project";
const ALIAS = "team-tools";
const HOST = "team-catalog";
const BUILT = "/built/claude";
const REF = `review@${HOST}`;
const OLD = builtMarketplaceDir(ROOT, ALIAS, "claude");
const ADD_ERROR = "catalogue already exists";
const RECLAIM = `Marketplace '${HOST}' was registered to a directory that no longer exists; re-registering it for this project. Plugins installed from it are removed and the ones this CLI manages are put back.`;

class RecoveringActivator extends FakeNativePluginActivator {
  readonly adds: Array<{ source: string; scope: MarketplaceScope | undefined }> = [];
  readonly removals: Array<{ name: string; scope: MarketplaceScope | undefined; force: boolean }> =
    [];

  constructor(private readonly failure?: "remove" | "retry" | "crash") {
    super({ available: true, registrationState: "dead" });
  }

  override addMarketplace(source: string, scope?: MarketplaceScope): void {
    this.adds.push({ source, scope });
    if (this.adds.length === 1) throw new NativePluginCliError(ADD_ERROR);
    if (this.failure === "retry") throw new NativePluginCliError("retry denied");
    if (this.failure === "crash") throw new Error("retry crashed");
    super.addMarketplace(source, scope);
  }

  override removeMarketplace(
    name: string,
    scope?: MarketplaceScope,
    options?: { force?: boolean }
  ): void {
    this.removals.push({ name, scope, force: options?.force === true });
    if (this.failure === "remove") throw new NativePluginCliError("remove denied");
    super.removeMarketplace(name, scope, options);
  }
}

interface RecoveryOptions {
  source?: string;
  userRoot?: string;
  scope?: MarketplaceScope;
  failure?: "remove" | "retry" | "crash";
  state?: "live" | "unknown";
  realpathFails?: readonly string[];
  host?: HostMarketplaceRegistryReader;
  plugins?: readonly HostPluginRegistryReading[];
  sourceAfterCollision?: "absent" | "foreign";
  settings?: string;
  ownRefs?: readonly string[];
}

async function recovery(options: RecoveryOptions = {}) {
  const source = options.source ?? OLD;
  const scope = options.scope ?? "project";
  const manifest = Manifest.create();
  const hasher = new DeterministicHasher();
  const settings = options.settings ?? "{}";
  manifest.addTool("claude", "1.0.0", [
    new InstallationFile({
      relativePath: ".claude/settings.json",
      content: settings,
      hash: hasher.hash(settings),
    }),
  ]);
  manifest.addPlugin(
    "claude",
    InstalledPlugin.fromMetadata(
      "review",
      "1.0.0",
      { kind: "local", path: "/plugins/review" },
      true,
      "project",
      ALIAS
    )
  );
  manifest.setNativeRegistrations("claude", {
    binary: "claude",
    marketplaces: [{ alias: ALIAS, hostName: HOST, provenance: { kind: "registry", source } }],
    pluginRefs: options.ownRefs ?? [],
  });
  const repo = new InMemoryManifestRepository(manifest, ROOT);
  const registry = new InMemoryMarketplaceRegistry();
  await registry.save(
    ROOT,
    Marketplace.create({
      name: ALIAS,
      source: { kind: "local", path: "/source" },
      scope,
      addedAt: "2026-09-15T00:00:00Z",
    })
  );
  class MissingDirectories extends InMemoryFileAdapter {
    override async realpath(path: string): Promise<string> {
      if (options.realpathFails?.includes(path)) throw new Error(`ENOENT: ${path}`);
      return super.realpath(path);
    }
  }
  const fs = new MissingDirectories({
    [`${BUILT}/.claude-plugin/marketplace.json`]: JSON.stringify({
      name: HOST,
      plugins: [{ name: "review" }],
    }),
    ...(options.settings === undefined
      ? {}
      : { [`${ROOT}/.claude/settings.json`]: options.settings }),
  });
  const logger = new CapturingLogger();
  const pluginReadings = [...(options.plugins ?? [{ location: "host plugins", refs: new Map() }])];
  const activator =
    options.state === undefined
      ? new RecoveringActivator(options.failure)
      : new FakeNativePluginActivator({
          available: true,
          conflictOnAdd: true,
          registrationState: options.state,
        });
  const delegate = new FakeNativeMarketplaceSourceReader(
    activator,
    "registry",
    () => HOST,
    new Map([[HOST, { kind: "registry", source }]])
  );
  const native: NativeMarketplaceSourceReader = {
    read: async (root) => {
      if (activator.removedMarketplaces.length > 0 && activator.addedMarketplaces.length === 0) {
        return { location: "host source after removal", entries: new Map() };
      }
      if (
        activator instanceof RecoveringActivator &&
        activator.adds.length > 0 &&
        activator.addedMarketplaces.length === 0 &&
        options.sourceAfterCollision !== undefined
      ) {
        return {
          location: "host source after collision",
          entries:
            options.sourceAfterCollision === "absent"
              ? new Map()
              : new Map([[HOST, { kind: "registry", source: "/foreign/source" }]]),
        };
      }
      return delegate.read(root);
    },
  };
  const useCase = new MarketplaceSyncSettingsUseCase(
    fs,
    repo,
    registry,
    hasher,
    logger,
    new Map([["claude", activator]]),
    fakeEnsureBuiltMarketplace(),
    new Map([
      [
        "claude",
        options.host ??
          new FakeHostMarketplaceRegistryReader({
            location: "host marketplaces",
            entries: new Map([[HOST, source]]),
          }),
      ],
    ]),
    () => options.userRoot ?? "",
    undefined,
    undefined,
    undefined,
    new Map([
      [
        "claude",
        {
          read: async () => {
            const reading = pluginReadings[0];
            if (pluginReadings.length > 1) pluginReadings.shift();
            return reading;
          },
        },
      ],
    ]),
    undefined,
    new Map([["claude", native]])
  );
  const result = await useCase.execute({ projectRoot: ROOT });
  return { activator, manifest, repo, logger, fs, result, useCase };
}

describe("marketplace sync recovery preserves public ownership and failure outcomes", () => {
  it.each(["project", "user"] as const)(
    "reclaims an owned dead catalogue at its marketplace's %s scope",
    async (scope) => {
      const { activator, result, manifest, logger } = await recovery({ scope });
      expect(activator).toBeInstanceOf(RecoveringActivator);
      if (!(activator instanceof RecoveringActivator))
        throw new Error("expected recovery activator");
      expect(activator.adds).toEqual([
        { source: BUILT, scope },
        { source: BUILT, scope },
      ]);
      expect(activator.removals).toEqual([{ name: HOST, scope, force: true }]);
      expect(activator.enabledPlugins).toEqual([REF]);
      expect(result).toEqual({
        activated: ["claude"],
        binaryMissing: [],
        warnings: [RECLAIM],
        errors: [],
      });
      expect(logger.warnMessages).toEqual([RECLAIM]);
      expect(manifest.getNativeRegistrations("claude")).toEqual({
        binary: "claude",
        marketplaces: [
          { alias: ALIAS, hostName: HOST, provenance: { kind: "registry", source: BUILT } },
        ],
        pluginRefs: [REF],
      });
    }
  );

  it("recognizes the original project path even when its directory and project root no longer resolve", async () => {
    const { activator, result } = await recovery({ realpathFails: [OLD, ROOT] });
    expect(activator.removedMarketplaces).toEqual([HOST]);
    expect(activator.enabledPlugins).toEqual([REF]);
    expect(result.warnings).toEqual([RECLAIM]);
    expect(result.errors).toEqual([]);
  });

  it("recognizes an owned vanished user cache using the unresolved user root", async () => {
    const userRoot = "/users/alice/aidd";
    const source = userBuiltMarketplaceDir(userRoot, "1.0.0", ALIAS, "claude");
    const { activator, result } = await recovery({
      source,
      userRoot,
      realpathFails: [source, userRoot],
    });
    expect(activator.removedMarketplaces).toEqual([HOST]);
    expect(activator.enabledPlugins).toEqual([REF]);
    expect(result.warnings).toEqual([RECLAIM]);
    expect(result.errors).toEqual([]);
  });

  it.each(["live", "unknown"] as const)(
    "reports the add refusal for a %s registration without force-removing it",
    async (state) => {
      const { activator, result } = await recovery({ state });
      expect(activator.forcedRemovals).toEqual([]);
      expect(activator.addedMarketplaces).toEqual([]);
      expect(result.warnings).toEqual([
        `Native plugin activation — register marketplace '${HOST}' skipped: marketplace is already added from a different source; remove it before adding this source`,
      ]);
      expect(result.errors).toEqual([]);
    }
  );

  it.each([
    "/foreign/cache",
    builtMarketplaceDir(ROOT, "different-marketplace", "claude"),
    builtMarketplaceDir(ROOT, ALIAS, "codex"),
    userBuiltMarketplaceDir("/users/alice/aidd", "1.0.0", ALIAS, "claude"),
  ])(
    "refuses force removal for a source outside this catalogue's recognized cache: %s",
    async (source) => {
      const { activator, result, manifest } = await recovery({ source });
      expect(activator.removedMarketplaces).toEqual([]);
      expect(activator.enabledPlugins).toEqual([REF]);
      expect(result.warnings).toEqual([
        `Native plugin activation — catalogue '${HOST}' host catalogue source is unproven; host registration left untouched. ${ADD_ERROR}`,
      ]);
      expect(manifest.getNativeRegistrations("claude")?.marketplaces[0]?.provenance).toEqual({
        kind: "registry",
        source,
      });
    }
  );

  it("keeps a failed remove recoverable and records the still-owned original source", async () => {
    const { activator, result, manifest, logger } = await recovery({ failure: "remove" });
    expect(activator.removedMarketplaces).toEqual([]);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(result.warnings).toEqual([
      RECLAIM,
      `Native plugin activation — unregister stale marketplace '${HOST}' skipped: remove denied`,
    ]);
    expect(logger.warnMessages).toEqual(result.warnings);
    expect(result.errors).toEqual([]);
    expect(manifest.getNativeRegistrations("claude")?.marketplaces[0]?.provenance).toEqual({
      kind: "registry",
      source: OLD,
    });
  });

  it("reports a failed retry separately from a successful forced remove", async () => {
    const { activator, result, logger } = await recovery({ failure: "retry" });
    expect(activator.removedMarketplaces).toEqual([HOST]);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(result.warnings).toEqual([
      RECLAIM,
      `Native plugin activation — register marketplace '${HOST}' skipped: retry denied`,
    ]);
    expect(logger.warnMessages).toEqual(result.warnings);
    expect(result.errors).toEqual([]);
  });

  it("returns a retry crash as a hard tool error and preserves earlier manifest ownership", async () => {
    const { activator, result, manifest } = await recovery({ failure: "crash" });
    expect(activator.removedMarketplaces).toEqual([HOST]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(result).toEqual({
      activated: [],
      binaryMissing: [],
      warnings: [RECLAIM],
      errors: [{ scope: "claude", message: "retry crashed" }],
    });
    expect(manifest.getNativeRegistrations("claude")?.marketplaces[0]?.provenance).toEqual({
      kind: "registry",
      source: OLD,
    });
  });

  it.each(["absent", "foreign"] as const)(
    "does not reclaim when the source becomes %s between the failed add and recovery",
    async (sourceAfterCollision) => {
      const { activator, result, manifest } = await recovery({ sourceAfterCollision });
      expect(activator.removedMarketplaces).toEqual([]);
      expect(activator.enabledPlugins).toEqual([]);
      expect(result.warnings).toEqual([
        `Native plugin activation — catalogue '${HOST}' collides with unproven AIDD ownership; host registration left untouched. ${ADD_ERROR}`,
      ]);
      expect(manifest.getNativeRegistrations("claude")?.marketplaces).toEqual([
        { alias: ALIAS, hostName: HOST, provenance: { kind: "registry", source: OLD } },
      ]);
      expect(result.errors).toEqual([]);
    }
  );

  it("reports the foreign plugin that appeared after add failed and leaves the host untouched", async () => {
    const foreign = `other@${HOST}`;
    const { activator, result } = await recovery({
      plugins: [
        { location: "host plugins", refs: new Map() },
        { location: "host plugins", refs: new Map([[foreign, { enabled: true }]]) },
      ],
    });
    expect(activator.removedMarketplaces).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(result.warnings).toEqual([
      `Native plugin activation — catalogue '${HOST}' collides with unproven AIDD ownership and foreign ref '${foreign}'; host registration left untouched. ${ADD_ERROR}`,
    ]);
    expect(result.errors).toEqual([]);
  });

  it("refuses recovery when the host marketplace registry disappears after the failed add", async () => {
    const owned = { location: "host marketplaces", entries: new Map([[HOST, OLD]]) };
    const { activator, result } = await recovery({
      host: new FakeHostMarketplaceRegistryReader(owned, owned, {
        location: "host marketplaces",
        absent: true,
      }),
    });
    expect(activator.removedMarketplaces).toEqual([]);
    expect(result.warnings).toEqual([
      `Native plugin activation — catalogue '${HOST}' host catalogue source is unproven; host registration left untouched. ${ADD_ERROR}`,
    ]);
    expect(result.errors).toEqual([]);
  });

  it("preserves an enabled project-owned ref without a machine manifest or another install", async () => {
    const { activator, result, manifest } = await recovery({
      ownRefs: [REF],
      plugins: [{ location: "host plugins", refs: new Map([[REF, { enabled: true }]]) }],
    });
    expect(activator.removedMarketplaces).toEqual([HOST]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(manifest.getNativeRegistrations("claude")?.pluginRefs).toEqual([REF]);
    expect(result.errors).toEqual([]);
  });

  it("does not resave the manifest after a repeated sync produces identical native ownership and settings", async () => {
    const { activator, result, useCase, repo, fs, manifest } = await recovery({
      settings: JSON.stringify({
        enabledPlugins: { [`review@${ALIAS}`]: true },
        permissions: { allow: ["Read"] },
      }),
    });
    expect(result.errors).toEqual([]);
    const saveCount = repo.saveCount;
    const second = await useCase.execute({ projectRoot: ROOT });
    expect(second).toEqual({ activated: ["claude"], binaryMissing: [], warnings: [], errors: [] });
    expect(repo.saveCount).toBe(saveCount);
    expect(activator.addedMarketplaces).toEqual([BUILT]);
    expect(manifest.getToolFiles("claude")[0]?.hash.value).toBe(
      new DeterministicHasher().hash(await fs.readFile(`${ROOT}/.claude/settings.json`)).value
    );
  });

  it.each(["null", "[]", "false", '"user value"'])(
    "rebuilds managed settings from a JSON root that is not a settings object: %s",
    async (settings) => {
      const { fs, manifest, result, logger } = await recovery({ settings });
      const content = await fs.readFile(`${ROOT}/.claude/settings.json`);
      expect(JSON.parse(content)).toEqual({ enabledPlugins: { [`review@${ALIAS}`]: true } });
      expect(manifest.getToolFiles("claude")[0]?.hash.value).toBe(
        new DeterministicHasher().hash(content).value
      );
      expect(logger.warnMessages).toEqual([RECLAIM]);
      expect(result.errors).toEqual([]);
    }
  );

  it("evicts only the obsolete marketplace key from otherwise empty managed settings", async () => {
    const { fs, manifest, result } = await recovery({
      settings: JSON.stringify({
        extraKnownMarketplaces: {},
        permissions: { allow: ["Read"] },
        enabledPlugins: { [`review@${ALIAS}`]: false, "personal@external": true },
      }),
    });
    const content = await fs.readFile(`${ROOT}/.claude/settings.json`);
    expect(JSON.parse(content)).toEqual({
      permissions: { allow: ["Read"] },
      enabledPlugins: { [`review@${ALIAS}`]: false, "personal@external": true },
    });
    expect(manifest.getToolFiles("claude")[0]?.hash.value).toBe(
      new DeterministicHasher().hash(content).value
    );
    expect(result.errors).toEqual([]);
  });
});

async function ownedNativeSettings(
  options: {
    toolId?: "codex" | "copilot";
    names?: readonly string[];
    settings?: string;
    withPlugins?: boolean;
    cachedRoot?: string;
    cachedCatalogue?: string;
  } = {}
) {
  const toolId = options.toolId ?? "copilot";
  const names = options.names ?? ["first"];
  const settings = options.settings ?? JSON.stringify({ permissions: { allow: ["Read"] } });
  const settingsPath = ".github/copilot/settings.json";
  const hasher = new DeterministicHasher();
  const project = Manifest.create();
  project.addTool(
    toolId,
    "1.0.0",
    toolId === "copilot"
      ? [
          new InstallationFile({
            relativePath: settingsPath,
            content: settings,
            hash: hasher.hash(settings),
          }),
        ]
      : []
  );
  const machine = Manifest.create();
  machine.addTool(toolId, "1.0.0", []);
  const registrations = names.map((name) => ({
    alias: `${name}-alias`,
    hostName: `${name}-catalog`,
    provenance: {
      kind: "effective-list" as const,
      root:
        name === (options.cachedCatalogue ?? names[0])
          ? (options.cachedRoot ?? `/built/${toolId}/${name}`)
          : `/built/${toolId}/${name}`,
      sourceType: "local",
      source: `/built/${toolId}/${name}`,
    },
  }));
  const refs =
    options.withPlugins === false
      ? []
      : registrations.map(
          (registration, index) => `review-${names[index]}@${registration.hostName}`
        );
  project.setNativeRegistrations(toolId, {
    binary: toolId,
    marketplaces: registrations,
    pluginRefs: refs,
  });
  machine.setNativeRegistrations(toolId, {
    binary: toolId,
    marketplaces: registrations,
    pluginRefs: [],
    pluginClaims: refs.map((ref) => ({ ref, dependents: [ROOT] })),
  });
  const projectRepo = new InMemoryManifestRepository(project, ROOT);
  const machineRepo = new InMemoryManifestRepository(machine);
  const registry = new InMemoryMarketplaceRegistry();
  const fs = new InMemoryFileAdapter({ [`${ROOT}/${settingsPath}`]: settings });
  const identities = new Map<string, string>();
  const initial = new Map<string, NativeMarketplaceSource>();
  for (const [index, name] of names.entries()) {
    const registration = registrations[index];
    const builtDir = `/built/${toolId}/${name}`;
    identities.set(builtDir, registration.hostName);
    initial.set(registration.hostName, registration.provenance);
    fs.setFile(
      `${builtDir}/${toolId === "copilot" ? ".plugin" : ".agents/plugins"}/marketplace.json`,
      JSON.stringify({ name: registration.hostName, plugins: [{ name: `review-${name}` }] })
    );
    await registry.save(
      ROOT,
      Marketplace.create({
        name: registration.alias,
        source: { kind: "local", path: `/sources/${name}` },
        scope: "project",
        addedAt: "2026-09-15T00:00:00Z",
      })
    );
    if (options.withPlugins !== false)
      project.addPlugin(
        toolId,
        InstalledPlugin.fromMetadata(
          `review-${name}`,
          "1.0.0",
          { kind: "local", path: `/sources/${name}/review` },
          true,
          "project",
          registration.alias
        )
      );
  }
  const activator = new FakeNativePluginActivator({ available: true });
  const logger = new CapturingLogger();
  const sync = new MarketplaceSyncSettingsUseCase(
    fs,
    projectRepo,
    registry,
    hasher,
    logger,
    new Map([[toolId, activator]]),
    {
      execute: async ({ marketplace }) => ({
        builtDir: `/built/${toolId}/${marketplace.name.replace(/-alias$/, "")}`,
        version: "1.0.0",
        rebuilt: false,
      }),
    },
    new Map(),
    () => "",
    undefined,
    undefined,
    undefined,
    new Map([
      [
        toolId,
        {
          read: async () => ({
            location: "host plugins",
            refs: new Map(refs.map((ref) => [ref, { enabled: true }])),
          }),
        },
      ],
    ]),
    machineRepo,
    new Map([
      [
        toolId,
        new FakeNativeMarketplaceSourceReader(
          activator,
          "effective-list",
          (path) => identities.get(path),
          initial
        ),
      ],
    ])
  );
  return {
    sync,
    fs,
    activator,
    logger,
    projectRepo,
    machineRepo,
    hasher,
    settingsPath,
    registrations,
    refs,
  };
}

describe("proven native catalogues update declarative settings only when required", () => {
  it("projects enabled refs from two distinct owned Copilot catalogues into the tracked shared settings", async () => {
    const f = await ownedNativeSettings({ names: ["first", "second"] });
    const result = await f.sync.execute({ projectRoot: ROOT });
    const content = await f.fs.readFile(`${ROOT}/${f.settingsPath}`);
    expect(result).toEqual({ activated: ["copilot"], binaryMissing: [], warnings: [], errors: [] });
    expect(JSON.parse(content)).toEqual({
      permissions: { allow: ["Read"] },
      enabledPlugins: { "review-first@first-catalog": true, "review-second@second-catalog": true },
    });
    expect(f.projectRepo.getCurrent()?.getToolFiles("copilot")[0]?.hash.value).toBe(
      f.hasher.hash(content).value
    );
    expect(f.projectRepo.getCurrent()?.getNativeRegistrations("copilot")).toEqual({
      binary: "copilot",
      marketplaces: f.registrations,
      pluginRefs: f.refs,
    });
    expect(f.activator.addedMarketplaces).toEqual([]);
    expect(f.activator.enabledPlugins).toEqual([]);
    expect(f.projectRepo.saveCount).toBe(1);
    expect(f.machineRepo.saveCount).toBe(0);
  });

  it("persists a missing declarative ref's hash even when native and machine ownership are already unchanged", async () => {
    const f = await ownedNativeSettings();
    await f.sync.execute({ projectRoot: ROOT });
    const content = await f.fs.readFile(`${ROOT}/${f.settingsPath}`);
    expect(JSON.parse(content).enabledPlugins).toEqual({ "review-first@first-catalog": true });
    expect(f.projectRepo.getCurrent()?.getToolFiles("copilot")[0]?.hash.value).toBe(
      f.hasher.hash(content).value
    );
    expect(f.projectRepo.saveCount).toBe(1);
    expect(f.machineRepo.saveCount).toBe(0);
    await f.sync.execute({ projectRoot: ROOT });
    expect(f.projectRepo.saveCount).toBe(1);
    expect(f.machineRepo.saveCount).toBe(0);
  });

  it("leaves malformed Copilot settings untouched without parsing warnings when no native refs are proven", async () => {
    const settings = "{ personalSetting: true,";
    const f = await ownedNativeSettings({ withPlugins: false, settings });
    const result = await f.sync.execute({ projectRoot: ROOT });
    expect(result).toEqual({ activated: ["copilot"], binaryMissing: [], warnings: [], errors: [] });
    expect(await f.fs.readFile(`${ROOT}/${f.settingsPath}`)).toBe(settings);
    expect(f.logger.warnMessages).toEqual([]);
    expect(f.projectRepo.saveCount).toBe(0);
    expect(f.machineRepo.saveCount).toBe(0);
  });

  it("re-registers an owned Codex local source whose cached root differs from its original build path", async () => {
    const f = await ownedNativeSettings({
      toolId: "codex",
      cachedRoot: "/host/cache/copied-marketplace",
    });
    const result = await f.sync.execute({ projectRoot: ROOT });
    expect(result).toEqual({ activated: ["codex"], binaryMissing: [], warnings: [], errors: [] });
    expect(f.activator.addedMarketplaces).toEqual(["/built/codex/first"]);
    expect(f.activator.removedMarketplaces).toEqual([]);
    expect(f.activator.enabledPlugins).toEqual([]);
    expect(
      f.projectRepo.getCurrent()?.getNativeRegistrations("codex")?.marketplaces[0]?.provenance
    ).toEqual({
      kind: "effective-list",
      root: "/built/codex/first",
      sourceType: "local",
      source: "/built/codex/first",
    });
    expect(
      f.machineRepo.getCurrent()?.getNativeRegistrations("codex")?.marketplaces[0]?.provenance
    ).toEqual({
      kind: "effective-list",
      root: "/built/codex/first",
      sourceType: "local",
      source: "/built/codex/first",
    });
    expect(f.machineRepo.saveCount).toBe(1);
  });

  it("persists a second catalogue's updated source while retaining an already identical first catalogue", async () => {
    const f = await ownedNativeSettings({
      toolId: "codex",
      names: ["first", "second"],
      cachedCatalogue: "second",
      cachedRoot: "/host/cache/second-copy",
    });
    const result = await f.sync.execute({ projectRoot: ROOT });
    expect(result.errors).toEqual([]);
    expect(f.activator.addedMarketplaces).toEqual(["/built/codex/second"]);
    const expected = f.registrations.map((registration) => ({
      ...registration,
      provenance: { ...registration.provenance, root: registration.provenance.source },
    }));
    expect(f.projectRepo.getCurrent()?.getNativeRegistrations("codex")?.marketplaces).toEqual(
      expected
    );
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations("codex")?.marketplaces).toEqual(
      expected
    );
    expect(f.projectRepo.saveCount).toBe(1);
    expect(f.machineRepo.saveCount).toBe(1);
  });
});

describe("shared framework references follow any successful native tool outcome", () => {
  it.each(["project", "user"] as const)(
    "records references according to the requested %s activation scope despite another tool's refusal",
    async (scope) => {
      const project = Manifest.create();
      project.addTool("claude", "1.0.0", []);
      project.addTool("codex", "1.0.0", []);
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        ROOT,
        Marketplace.create({
          name: "aidd-framework",
          source: { kind: "local", path: "/framework" },
          scope: "user",
          addedAt: "2026-09-15T00:00:00Z",
        })
      );
      const fs = new InMemoryFileAdapter({
        "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
          name: "aidd-framework",
          plugins: [],
        }),
        "/built/codex/.agents/plugins/marketplace.json": JSON.stringify({
          name: "aidd-framework",
          plugins: [],
        }),
      });
      fs.setSymlink(ROOT, "/real/project");
      const claude = new FakeNativePluginActivator({ available: true, enablesPlugins: false });
      const codex = new FakeNativePluginActivator({ available: true, enablesPlugins: false });
      const recorded: Array<{ version: string; projectRoot: string }> = [];
      const references: UserSourceReferences = {
        addReference: async (version, projectRoot) => {
          recorded.push({ version, projectRoot });
        },
        removeReference: async () => undefined,
        listAllReferencingProjects: async () => [],
      };
      const sync = new MarketplaceSyncSettingsUseCase(
        fs,
        new InMemoryManifestRepository(project),
        registry,
        new DeterministicHasher(),
        new CapturingLogger(),
        new Map([
          ["claude", claude],
          ["codex", codex],
        ]),
        fakeEnsureBuiltMarketplace(),
        new Map(),
        () => "",
        undefined,
        references,
        { get: () => "2.0.0" },
        new Map([
          ["claude", { read: async () => ({ location: "host plugins", refs: new Map() }) }],
          ["codex", { read: async () => ({ location: "host plugins", refs: new Map() }) }],
        ]),
        undefined,
        new Map<"claude" | "codex", NativeMarketplaceSourceReader>([
          [
            "claude",
            new FakeNativeMarketplaceSourceReader(
              claude,
              "registry",
              () => "aidd-framework",
              new Map()
            ),
          ],
          [
            "codex",
            {
              read: async () => ({
                location: "host sources",
                entries: new Map([["aidd-framework", null]]),
              }),
            },
          ],
        ])
      );
      const result = await sync.execute({ projectRoot: ROOT, scope });
      expect(result.activated).toEqual(["claude", "codex"]);
      expect(result.errors).toEqual([]);
      expect(result.warnings.join(" ")).toContain("host source unproven");
      expect(claude.addedMarketplaces).toEqual(["/built/claude"]);
      expect(codex.addedMarketplaces).toEqual([]);
      expect(recorded).toEqual(
        scope === "project" ? [{ version: "2.0.0", projectRoot: "/real/project" }] : []
      );
    }
  );
});

// TEMPORARY DIAGNOSTIC — deliberately failing, to read Windows state from the CI log.
// Delete with the branch.
describe("WINDOWS DIAGNOSTIC", () => {
  it("dumps the state the failing tests depend on", async () => {
    const { fs } = await recovery({ settings: "null" });
    const read = await fs
      .readFile(`${ROOT}/.claude/settings.json`)
      .catch((error: Error) => `THREW ${error.message}`);
    const viaResolve = await fs
      .readFile(resolve(ROOT, ".claude/settings.json"))
      .catch((error: Error) => `THREW ${error.message}`);
    const state = {
      sep,
      ROOT,
      OLD,
      resolved: resolve(ROOT, ".claude/settings.json"),
      keys: fs.listAll(),
      readTemplate: read,
      readResolve: viaResolve,
    };
    expect(JSON.stringify(state, null, 1)).toBe("DIAGNOSTIC");
  });
});
