import { resolve } from "node:path";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { registerMarketplacePlugin } from "../../../src/contexts/installation/application/materialize/register-marketplace-plugin.js";
import type { BuiltMarketplaceEnsurer } from "../../../src/contexts/installation/contract/built-marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import { PluginDistribution } from "../../../src/shared/domain/plugin/plugin-distribution.js";
import type { PluginSource } from "../../../src/shared/domain/source.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { parseJsonRecord } from "../../shared/testing/json-value.builder.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import { FakeHostMarketplaceSources } from "./fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "./fake-host-plugin-registry.fake.js";

export const PROJECT_ROOT = "/test-project";
export const SHARED_SETTINGS = resolve(PROJECT_ROOT, ".claude/settings.json");

export function distribution(claude: AiToolId, name: string): PluginDistribution {
  const files = [{ relativePath: "commands/hello.md", content: "# Hello" }];
  return new PluginDistribution({
    manifest: { name, version: "1.0.0" },
    format: claude,
    files,
    components: { commands: files, agents: [], rules: [], skills: [], hooks: [], mcp: [] },
  });
}

export interface SyncSetup {
  readonly tools: ToolCatalog;
  readonly claude: AiToolId;
  /** Content written to `.claude/settings.json` before the sync, when given. */
  readonly settings?: string;
  /** Marketplaces to register; the first is the one plugins are attached to. */
  readonly marketplaceNames?: readonly string[];
  readonly ensureBuilt?: BuiltMarketplaceEnsurer;
  /** Whether claude's own CLI is on PATH. Defaults to available. */
  readonly available?: boolean;
  /** Makes the activator crash on `addMarketplace` with a plain `Error`. */
  readonly crashOnAddMarketplace?: boolean;
  /** Refs that fail to enable, a recoverable, best-effort `NativePluginCliError`. */
  readonly failOnPlugins?: readonly string[];
  readonly activator?: FakeHostActions;
  /** Explicitly prove the catalogue is already AIDD-owned before testing exact host refresh. */
  readonly ownedCatalog?: true;
  readonly marketplaceSource?: (name: string) => PluginSource;
}

export class ActivatorFailingAtUpgrade extends FakeHostActions {
  constructor(private readonly failure: Error) {
    super({ available: true });
  }

  override upgradeMarketplaces(): void {
    throw this.failure;
  }
}

/** A real build always leaves a catalog where `fakeEnsureBuiltMarketplace()` resolves
 * "claude", and an unreadable one is a hard failure, so the fixture must leave one too. */
export function seededBuiltCatalog(name = "aidd-framework"): InMemoryFileAdapter {
  return new InMemoryFileAdapter({
    "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
      name,
      version: "1.0.0",
      plugins: [],
    }),
  });
}

export function readableClaudePluginRegistry(claude: AiToolId) {
  return new Map([
    [
      claude,
      new FakeHostPluginRegistry({
        location: "/home/.claude/plugins/installed_plugins.json",
        refs: new Map(),
      }),
    ],
  ]);
}

export function freshClaudeSource(
  claude: AiToolId,
  activator: FakeHostActions,
  name = "aidd-framework"
) {
  return new Map([
    [
      claude,
      new FakeHostMarketplaceSources(
        activator,
        "registry",
        (path) => (path === "/built/claude" ? name : undefined),
        new Map()
      ),
    ],
  ]);
}

async function seededCatalogs(names: readonly string[]): Promise<InMemoryFileAdapter> {
  const fs = seededBuiltCatalog(names[0]);
  for (const name of names.slice(1)) {
    await fs.writeFile(
      `/built/claude-${name}/.claude-plugin/marketplace.json`,
      JSON.stringify({ name, version: "1.0.0", plugins: [] })
    );
  }
  return fs;
}

async function projectManifestWithPlugin(
  setup: SyncSetup,
  marketplace: string
): Promise<InMemoryManifestRepository> {
  const { claude } = setup;
  const manifestRepo = new InMemoryManifestRepository();
  const manifest = Manifest.create();
  manifest.addTool(claude, "test", []);
  await registerMarketplacePlugin({
    dist: distribution(claude, "aidd-context"),
    tool: setup.tools.aiProfile(claude),
    source: { kind: "local", path: "/plugin-source" },
    projectRoot: PROJECT_ROOT,
    manifest,
    marketplace,
  });
  await manifestRepo.save(manifest);
  return manifestRepo;
}

async function registeredProjectMarketplaces(
  names: readonly string[],
  setup: SyncSetup
): Promise<InMemoryMarketplaceRegistry> {
  const registry = new InMemoryMarketplaceRegistry();
  for (const name of names) {
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name,
        source: setup.marketplaceSource?.(name) ?? { kind: "local", path: `/source/${name}` },
        scope: "project",
        addedAt: "2026-01-01T00:00:00Z",
      })
    );
  }
  return registry;
}

function activatorOf(setup: SyncSetup): FakeHostActions {
  return (
    setup.activator ??
    new FakeHostActions({
      available: setup.available ?? true,
      crashOnAddMarketplace: setup.crashOnAddMarketplace ?? false,
      failOnPlugins: setup.failOnPlugins ?? [],
    })
  );
}

function ownedMachineManifest(claude: AiToolId, name: string): Manifest {
  const machine = Manifest.create();
  machine.addTool(claude, "test", []);
  machine.setNativeRegistrations(claude, {
    binary: "claude",
    marketplaces: [
      { alias: name, hostName: name, provenance: { kind: "registry", source: "/built/claude" } },
    ],
    pluginRefs: [],
    pluginClaims: [],
  });
  return machine;
}

function ensureBuiltPerMarketplace(primary: string): BuiltMarketplaceEnsurer {
  return {
    execute: async ({ marketplace, target }) => ({
      builtDir:
        marketplace.name === primary ? `/built/${target}` : `/built/${target}-${marketplace.name}`,
      version: "test",
      rebuilt: true,
    }),
  };
}

function nativeSourcesOf(
  claude: AiToolId,
  activator: FakeHostActions,
  catalogs: { readonly names: readonly string[]; readonly owned: boolean }
) {
  const { names, owned } = catalogs;
  const [primary, ...others] = names;
  const known = owned
    ? new Map([[primary, { kind: "registry" as const, source: "/built/claude" }]])
    : new Map();
  return new Map([
    [
      claude,
      new FakeHostMarketplaceSources(
        activator,
        "registry",
        (path) =>
          path === "/built/claude"
            ? primary
            : others.find((name) => path === `/built/claude-${name}`),
        known
      ),
    ],
  ]);
}

async function writtenSettings(fs: InMemoryFileAdapter) {
  if (!(await fs.fileExists(SHARED_SETTINGS))) return undefined;
  return parseJsonRecord(await fs.readFile(SHARED_SETTINGS));
}

async function syncWith(setup: SyncSetup) {
  const { claude } = setup;
  const names = setup.marketplaceNames ?? ["aidd-framework"];
  const primary = names[0] ?? "aidd-framework";
  const fs = await seededCatalogs(names);
  const manifestRepo = await projectManifestWithPlugin(setup, primary);
  const registry = await registeredProjectMarketplaces(names, setup);
  if (setup.settings !== undefined) await fs.writeFile(SHARED_SETTINGS, setup.settings);
  const logger = new CapturingLogger();
  const activator = activatorOf(setup);
  const machine = setup.ownedCatalog ? ownedMachineManifest(claude, primary) : undefined;
  const useCase = marketplaceSync({
    tools: setup.tools,
    fs,
    manifestRepo,
    marketplaceRegistry: registry,
    logger,
    activators: new Map([[claude, activator]]),
    ensureBuilt: setup.ensureBuilt ?? ensureBuiltPerMarketplace(primary),
    hostPluginRegistries: readableClaudePluginRegistry(claude),
    userManifestRepo: machine === undefined ? undefined : new InMemoryManifestRepository(machine),
    nativeSources: nativeSourcesOf(claude, activator, {
      names,
      owned: setup.ownedCatalog === true,
    }),
  });
  const result = await useCase.execute({ projectRoot: PROJECT_ROOT });
  return { written: await writtenSettings(fs), logger, fs, activator, result };
}

/** The scenario's sync, over the catalog and the claude id its test names. */
export function syncOf(tools: ToolCatalog, claude: AiToolId) {
  return (setup: Omit<SyncSetup, "tools" | "claude"> = {}) => syncWith({ ...setup, tools, claude });
}
