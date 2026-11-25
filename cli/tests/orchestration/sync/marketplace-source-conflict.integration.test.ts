import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { render } from "../../../src/presentation/errors/error-translator.presenter.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { FakeHostMarketplaceRegistry } from "../../contexts/host-registration/testing/fake-host-marketplace-registry.fake.js";
import { FakeHostMarketplaceSources } from "../../contexts/host-registration/testing/fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "../../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import {
  SYNTHETIC_TOOL,
  syntheticNativeCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";

const tool = SYNTHETIC_TOOL;

const PROJECT_ROOT = "/test-project";
const CATALOG_RELATIVE = ".plugin/marketplace.json";
const REGISTRY_LOCATION = `/home/.${tool}/known_marketplaces.json`;

interface HeldCatalog {
  /** Where the host's registry resolves the name to - the directory a catalog would
   * be read from, if anything was ever written there. */
  readonly path: string;
  readonly name?: string;
  readonly version?: string;
  readonly pluginNames?: readonly string[];
}

interface Setup {
  /** The host lists its marketplaces itself instead of keeping a registry file. */
  readonly listed?: boolean;
  /** `name` written into the built catalog's own marketplace.json - defaults to the
   * aidd-side name so most scenarios agree by construction. */
  readonly catalogName?: string;
  readonly aiddName?: string;
  readonly requestedVersion?: string;
  readonly requestedPluginNames?: readonly string[];
  readonly hostReader?: FakeHostMarketplaceRegistry;
  /** Catalog content to pre-write at the path this test's `hostReader` names as registered;
   * omitted, that path holds nothing readable, standing in for a directory that is gone. */
  readonly heldCatalog?: HeldCatalog;
  /** Skips writing at the built dir this project just "built" to, standing in for a build that
   * reported success but left nothing readable where its own tool profile probes. */
  readonly omitRequestedCatalog?: boolean;
  readonly fs?: InMemoryFileAdapter;
  /** A prior user manifest claim, not this project's plugin projection, proves catalogue ownership. */
  readonly ownedCatalog?: true;
}

class RealpathRefusingFileAdapter extends InMemoryFileAdapter {
  constructor(private readonly refused: string) {
    super({}, [PROJECT_ROOT]);
  }

  override async realpath(path: string): Promise<string> {
    if (path === this.refused) throw Object.assign(new Error("EACCES"), { code: "EACCES" });
    return super.realpath(path);
  }
}

function catalogJson(name: string, version: string | undefined, pluginNames: readonly string[]) {
  return JSON.stringify({
    name,
    version,
    plugins: pluginNames.map((pluginName) => ({ name: pluginName })),
  });
}

async function writeCatalogs(
  fs: InMemoryFileAdapter,
  setup: Setup,
  catalogName: string,
  builtDir: string
) {
  const relative = CATALOG_RELATIVE;
  if (!setup.omitRequestedCatalog) {
    await fs.writeFile(
      `${builtDir}/${relative}`,
      catalogJson(catalogName, setup.requestedVersion, setup.requestedPluginNames ?? [])
    );
  }
  const rc = setup.heldCatalog;
  if (rc === undefined) return;
  await fs.writeFile(
    `${rc.path}/${relative}`,
    catalogJson(rc.name ?? catalogName, rc.version, rc.pluginNames ?? [])
  );
}

function provenanceOf(listed: boolean, registeredSource: string | undefined) {
  if (registeredSource === undefined) return undefined;
  if (!listed) return { kind: "registry", source: registeredSource } as const;
  return {
    kind: "effective-list",
    root: registeredSource,
    sourceType: "local",
    source: registeredSource,
  } as const;
}

function ownedMachineManifest(
  toolId: AiToolId,
  aiddName: string,
  catalogName: string,
  currentSource: ReturnType<typeof provenanceOf>
) {
  const machine = Manifest.create();
  machine.addTool(toolId, "test", []);
  const records = new Map([
    [
      toolId,
      {
        binary: toolId,
        marketplaces: [
          {
            alias: aiddName,
            hostName: catalogName,
            ...(currentSource === undefined ? {} : { provenance: currentSource }),
          },
        ],
        pluginRefs: [],
        pluginClaims: [],
      },
    ],
  ]);
  return new InMemoryManifestRepository(machine, undefined, records);
}

function nativeSourceReader(
  listed: boolean,
  activator: FakeHostActions,
  hostReading: Awaited<ReturnType<FakeHostMarketplaceRegistry["read"]>> | undefined,
  catalogName: string,
  builtDir: string,
  currentSource: ReturnType<typeof provenanceOf>
) {
  if (hostReading?.unreadable !== undefined) {
    const { location, unreadable } = hostReading;
    return { read: async () => ({ location, unreadable }) };
  }
  return new FakeHostMarketplaceSources(
    activator,
    listed ? "effective-list" : "registry",
    (path) => (path === builtDir ? catalogName : undefined),
    currentSource === undefined ? new Map() : new Map([[catalogName, currentSource]])
  );
}

function ownedMachineOf(
  setup: Setup,
  aiddName: string,
  catalogName: string,
  currentSource: ReturnType<typeof provenanceOf>
) {
  if (!setup.ownedCatalog) return undefined;
  return ownedMachineManifest(tool, aiddName, catalogName, currentSource);
}

async function projectWithOneMarketplace(toolId: AiToolId, aiddName: string) {
  const manifestRepo = new InMemoryManifestRepository();
  const registry = new InMemoryMarketplaceRegistry();
  const manifest = Manifest.create();
  manifest.addTool(toolId, "test", []);
  await manifestRepo.save(manifest);
  await registry.save(
    PROJECT_ROOT,
    Marketplace.create({
      name: aiddName,
      source: { kind: "local", path: `/source/${aiddName}` },
      scope: "project",
      addedAt: "2026-01-01T00:00:00Z",
    })
  );
  return { manifestRepo, registry };
}

async function sync(setup: Setup = {}) {
  const toolId = tool;
  const listed = setup.listed ?? false;
  const aiddName = setup.aiddName ?? "probe-mkt";
  const catalogName = setup.catalogName ?? aiddName;
  const fs = setup.fs ?? new InMemoryFileAdapter({}, [PROJECT_ROOT]);
  const { manifestRepo, registry } = await projectWithOneMarketplace(toolId, aiddName);
  const builtDir = `/built/${toolId}`;
  await writeCatalogs(fs, setup, catalogName, builtDir);
  const activator = new FakeHostActions({ available: true });
  const hostReading = listed ? undefined : await setup.hostReader?.read();
  const currentSource = provenanceOf(listed, hostReading?.entries?.get(catalogName));
  const machine = ownedMachineOf(setup, aiddName, catalogName, currentSource);
  const useCase = marketplaceSync({
    tools: syntheticNativeCatalog(tool, listed ? "list-command" : "registry"),
    fs,
    manifestRepo,
    marketplaceRegistry: registry,
    logger: new CapturingLogger(),
    activators: new Map([[toolId, activator]]),
    ensureBuilt: fakeEnsureBuiltMarketplace((target) => `/built/${target}`),
    hostMarketplaceRegistries: new Map(
      setup.hostReader === undefined ? [] : [[toolId, setup.hostReader]]
    ),
    hostPluginRegistries: new Map([
      [
        toolId,
        new FakeHostPluginRegistry({
          location: "/home/dev/.host/plugins/installed_plugins.json",
          refs: new Map(),
        }),
      ],
    ]),
    userManifestRepo: machine,
    nativeSources: new Map([
      [
        toolId,
        nativeSourceReader(listed, activator, hostReading, catalogName, builtDir, currentSource),
      ],
    ]),
  });
  const result = await useCase.execute({ projectRoot: PROJECT_ROOT });
  return { result, activator, manifestRepo, builtDir, catalogRelative: CATALOG_RELATIVE };
}

describe("the sync guard against a marketplace name a host already holds", () => {
  it("refuses when a different catalog is registered under the same name, and names both sources and the plugin difference", async () => {
    const hostReader = new FakeHostMarketplaceRegistry({
      location: REGISTRY_LOCATION,
      entries: new Map([["probe-mkt", "/other/src"]]),
    });

    const { result, activator } = await sync({
      hostReader,
      requestedPluginNames: ["sample-plugin"],
      heldCatalog: { path: "/other/src", pluginNames: ["different-plugin"] },
    });

    expect(activator.addedMarketplaces).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(render(result.errors[0]?.error)).toMatch(/different catalog/);
    expect(render(result.errors[0]?.error)).toMatch(/probe-mkt/);
    expect(render(result.errors[0]?.error)).toMatch(/\/other\/src/);
    expect(render(result.errors[0]?.error)).toMatch(/\+sample-plugin/);
    expect(render(result.errors[0]?.error)).toMatch(/-different-plugin/);
  });

  it("does not refuse when only the version differs under the same name and plugin set - the host repointing to a newer build it already knows, not a different marketplace", async () => {
    const hostReader = new FakeHostMarketplaceRegistry({
      location: REGISTRY_LOCATION,
      entries: new Map([["probe-mkt", "/other/src"]]),
    });

    const { result, activator } = await sync({
      hostReader,
      requestedVersion: "2.0.0",
      ownedCatalog: true,
      requestedPluginNames: ["sample-plugin"],
      heldCatalog: { path: "/other/src", version: "1.0.0", pluginNames: ["sample-plugin"] },
    });

    expect(activator.addedMarketplaces).toEqual([`/built/${tool}`]);
    expect(result.errors).toEqual([]);
  });

  it("does not refuse a catalog registered again with only its version changed, though no earlier claim proves its source", async () => {
    const hostReader = new FakeHostMarketplaceRegistry({
      location: REGISTRY_LOCATION,
      entries: new Map([["probe-mkt", "/other/src"]]),
    });

    const { result, activator } = await sync({
      hostReader,
      requestedVersion: "2.0.0",
      requestedPluginNames: ["sample-plugin"],
      heldCatalog: { path: "/other/src", version: "1.0.0", pluginNames: ["sample-plugin"] },
    });

    expect(result.errors).toEqual([]);
    expect(activator.addedMarketplaces).toEqual([]);
  });

  it("does not refuse when the host's registry already holds the same resolved source", async () => {
    const hostReader = new FakeHostMarketplaceRegistry({
      location: REGISTRY_LOCATION,
      // InMemoryFileAdapter.realpath is identity absent a declared symlink, so this is exactly what
      // the guard resolves `builtDir` to: both reads land on the same catalog.
      entries: new Map([["probe-mkt", `/built/${tool}`]]),
    });

    const { result, activator } = await sync({ hostReader, ownedCatalog: true });

    expect(activator.addedMarketplaces).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("does not refuse when the same catalog is registered from a different, resolved path - two projects sharing one build", async () => {
    // Two independent projects build the same framework fixture to their own cache and
    // register under the same name: same version, same plugins, only a different directory.
    const hostReader = new FakeHostMarketplaceRegistry({
      location: REGISTRY_LOCATION,
      entries: new Map([["probe-mkt", `/other-project/built/${tool}`]]),
    });

    const { result, activator } = await sync({
      hostReader,
      requestedVersion: "1.0.0",
      ownedCatalog: true,
      requestedPluginNames: ["sample-plugin"],
      heldCatalog: {
        path: `/other-project/built/${tool}`,
        version: "1.0.0",
        pluginNames: ["sample-plugin"],
      },
    });

    expect(activator.addedMarketplaces).toEqual([`/built/${tool}`]);
    expect(result.errors).toEqual([]);
  });

  it("refuses an unproven dead entry instead of re-adding over its host name", async () => {
    const hostReader = new FakeHostMarketplaceRegistry({
      location: REGISTRY_LOCATION,
      entries: new Map([["probe-mkt", "/gone"]]),
    });

    // No `heldCatalog` - nothing is ever written at "/gone", so reading its
    // catalog fails exactly as it would for a directory that no longer exists.
    const { result, activator } = await sync({ hostReader });

    expect(activator.addedMarketplaces).toEqual([]);
    expect(result.warnings.join("\n")).toContain("legacy claim has no source proof");
    expect(result.errors).toEqual([]);
  });

  it("registers freely when this project's own local alias diverges from its built catalog's own name - a supported capability, not a fault", async () => {
    const hostReader = new FakeHostMarketplaceRegistry({
      location: REGISTRY_LOCATION,
      entries: new Map(),
    });

    const { result, activator, manifestRepo } = await sync({
      aiddName: "mon-nom",
      catalogName: "upstream",
      hostReader,
    });

    expect(activator.addedMarketplaces).toEqual([`/built/${tool}`]);
    expect(result.errors).toEqual([]);
    const registrations = manifestRepo.records.get(tool);
    expect(registrations?.marketplaces).toEqual([
      expect.objectContaining({ alias: "mon-nom", hostName: "upstream" }),
    ]);
  });

  it("never reads a host registry for a tool whose profile declares none, and still registers it", async () => {
    // A listed host's profile declares no `marketplaceRegistry` - this reader would refuse
    // every request if it were ever consulted, which is exactly what proves it is not.
    const hostReader = new FakeHostMarketplaceRegistry({
      location: "/wherever",
      entries: new Map([["probe-mkt", "/anything-else"]]),
    });

    const { result, activator } = await sync({ listed: true, hostReader });

    expect(hostReader.reads).toBe(0);
    expect(activator.addedMarketplaces).toEqual([`/built/${tool}`]);
    expect(result.errors).toEqual([]);
  });

  it("names both sources, the plugin difference, the registry file and the commands to run, in the refusal", async () => {
    const hostReader = new FakeHostMarketplaceRegistry({
      location: REGISTRY_LOCATION,
      entries: new Map([["probe-mkt", "/other/src"]]),
    });

    const { result } = await sync({
      hostReader,
      requestedPluginNames: ["sample-plugin"],
      heldCatalog: { path: "/other/src", pluginNames: ["different-plugin"] },
    });

    expect(result.errors).toHaveLength(1);
    expect(render(result.errors[0]?.error)).toBe(
      `Marketplace 'probe-mkt' is already registered from a different catalog: /other/src differs from the one requested, /built/${tool} — plugins differ (+sample-plugin, -different-plugin), per ${REGISTRY_LOCATION}. Do not remove a catalogue another user or project may depend on. Reconcile the host source manually before retrying \`aidd sync\`.`
    );
  });

  it("registers from the built path as given when that path cannot be resolved", async () => {
    const hostReader = new FakeHostMarketplaceRegistry({
      location: REGISTRY_LOCATION,
      entries: new Map([["probe-mkt", `/old/${tool}`]]),
    });

    const { result, activator } = await sync({
      hostReader,
      fs: new RealpathRefusingFileAdapter(`/built/${tool}`),
      ownedCatalog: true,
      heldCatalog: { path: `/old/${tool}` },
    });

    expect(result.errors).toStrictEqual([]);
    expect(activator.addedMarketplaces).toStrictEqual([`/built/${tool}`]);
  });
});

describe("when the catalog this project just built cannot be read back", () => {
  it("registers nothing and reports an error naming the unreadable file, rather than falling back to this project's own local alias", async () => {
    const { result, activator, manifestRepo, builtDir, catalogRelative } = await sync({
      aiddName: "mon-nom",
      omitRequestedCatalog: true,
    });

    expect(activator.addedMarketplaces).toEqual([]);
    expect(result.errors).toHaveLength(1);
    // join(), matching `marketplaceCatalogProbePath`: on win32 it produces a backslash-joined path,
    // which a forward-slash template literal would never find inside the thrown message.
    expect(render(result.errors[0]?.error)).toContain(join(builtDir, catalogRelative));
    // Never written as `hostName` - a manifest that guessed the alias would go on
    // claiming a registration the host was never asked to hold.
    expect(manifestRepo.records.get(tool)).toBeUndefined();
  });
});
