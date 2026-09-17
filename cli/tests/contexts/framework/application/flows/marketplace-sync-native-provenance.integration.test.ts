import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { MarketplaceSyncSettingsUseCase } from "../../../../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import type { HostPluginRegistryReader } from "../../../../../src/contexts/tools/domain/ports/host-plugin-registry-reader.js";
import type { NativeMarketplaceSourceReader } from "../../../../../src/contexts/tools/domain/ports/native-marketplace-source-reader.js";
import type { AiToolId } from "../../../../../src/kernel/tool.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { FakeHostPluginRegistryReader } from "../../../../helpers/ports/fake-host-plugin-registry-reader.js";
import { FakeNativeMarketplaceSourceReader } from "../../../../helpers/ports/fake-native-marketplace-source-reader.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

const PROJECT_ROOT = "/project-a";
const CATALOG = "aidd-framework";
const PLUGIN_REF = `aidd-dev@${CATALOG}`;
const FOREIGN_REF = `someone-elses-plugin@${CATALOG}`;
const CACHE_WITNESS = "/fake-home/host-cache/aidd-framework/foreign-plugin/bytes";
const HOST_CATALOG_WITNESS = "/fake-home/host-catalog/aidd-framework/marketplace.json";
const FOREIGN_CATALOG_BYTES = '{"name":"aidd-framework","source":"foreign-repo","marker":7}';

class NamedActivator extends FakeNativePluginActivator {
  readonly refreshedCatalogs: string[] = [];

  override upgradeMarketplaces(name?: string): void {
    this.refreshedCatalogs.push(name ?? "<all>");
    super.upgradeMarketplaces();
  }
}

function makeSync(
  toolId: "codex" | "copilot",
  options: {
    machine?: Manifest;
    hostRefs?: ReadonlyMap<string, { enabled: boolean }>;
    conflictOnAdd?: boolean;
    projectNativePluginRefs?: readonly string[];
    hostReader?: HostPluginRegistryReader;
    sourceReader?: NativeMarketplaceSourceReader;
  } = {}
) {
  const builtDir = `/built/${toolId}`;
  const catalogPath =
    toolId === "codex"
      ? `${builtDir}/.agents/plugins/marketplace.json`
      : `${builtDir}/.plugin/marketplace.json`;
  const hostCatalogBytes = options.machine
    ? '{"name":"aidd-framework","source":"aidd-owned","marker":7}'
    : FOREIGN_CATALOG_BYTES;
  const fs = new InMemoryFileAdapter({
    [catalogPath]: JSON.stringify({
      name: CATALOG,
      version: "1.0.0",
      plugins: [{ name: "aidd-dev" }],
    }),
    [CACHE_WITNESS]: "foreign bytes stay byte-for-byte",
    [HOST_CATALOG_WITNESS]: hostCatalogBytes,
  });
  const project = Manifest.create();
  project.addTool(toolId, "1.0.0", []);
  project.addPlugin(
    toolId,
    InstalledPlugin.fromMetadata(
      "aidd-dev",
      "1.0.0",
      { kind: "local", path: "/framework" },
      true,
      "project",
      CATALOG
    )
  );
  if (options.projectNativePluginRefs !== undefined) {
    project.setNativeRegistrations(toolId, {
      binary: toolId,
      marketplaces: [],
      pluginRefs: options.projectNativePluginRefs,
    });
  }
  const projectRepo = new InMemoryManifestRepository(project, PROJECT_ROOT);
  const machineRepo = new InMemoryManifestRepository(options.machine ?? null);
  const registry = new InMemoryMarketplaceRegistry();
  registry.save(
    PROJECT_ROOT,
    Marketplace.create({
      name: CATALOG,
      source: { kind: "local", path: "/framework" },
      scope: "user",
      addedAt: "2026-09-15T00:00:00Z",
    })
  );
  const activator = new NamedActivator({
    available: true,
    conflictOnAdd: options.conflictOnAdd ?? false,
  });
  const logger = new CapturingLogger();
  const hostRefs = options.hostRefs ?? new Map();
  const currentSource = options.machine
    ? builtDir
    : options.conflictOnAdd === true || hostRefs.has(FOREIGN_REF)
      ? "/fake-home/host-catalog/aidd-framework"
      : undefined;
  const useCase = new MarketplaceSyncSettingsUseCase(
    fs,
    projectRepo,
    registry,
    new DeterministicHasher(),
    logger,
    new Map([[toolId, activator]]),
    fakeEnsureBuiltMarketplace(() => builtDir),
    new Map(),
    () => "",
    undefined,
    undefined,
    undefined,
    new Map([
      [
        toolId as AiToolId,
        options.hostReader ??
          new FakeHostPluginRegistryReader({
            location: `/fake-home/${toolId}/registry`,
            refs: hostRefs,
          }),
      ],
    ]),
    machineRepo,
    new Map([
      [
        toolId as AiToolId,
        options.sourceReader ??
          new FakeNativeMarketplaceSourceReader(
            activator,
            "effective-list",
            (path) => (path === builtDir ? CATALOG : undefined),
            currentSource === undefined
              ? new Map()
              : new Map([
                  [
                    CATALOG,
                    {
                      kind: "effective-list",
                      root: currentSource,
                      sourceType: "local",
                      source: currentSource,
                    },
                  ],
                ])
          ),
      ],
    ])
  );
  return { useCase, fs, projectRepo, machineRepo, registry, activator, logger, hostCatalogBytes };
}

function canonicallyOwned(toolId: "codex" | "copilot"): Manifest {
  const machine = Manifest.create();
  machine.addTool(toolId, "1.0.0", []);
  machine.setNativeRegistrations(toolId, {
    binary: toolId,
    marketplaces: [
      {
        alias: CATALOG,
        hostName: CATALOG,
        provenance: {
          kind: "effective-list",
          root: `/built/${toolId}`,
          sourceType: "local",
          source: `/built/${toolId}`,
        },
      },
    ],
    pluginRefs: [],
    pluginClaims: [{ ref: PLUGIN_REF, dependents: [PROJECT_ROOT] }],
  });
  return machine;
}

describe.each(["codex", "copilot"] as const)("%s native marketplace provenance", (toolId) => {
  it.each([
    "recovered proof",
    "recovered proof with a shared host alias",
    "foreign source",
    "missing source",
    "foreign ref",
    "unreadable refs",
  ] as const)(
    "preserves existing projections after an initial source-read refusal followed by %s",
    async (change) => {
      const recovered = change.startsWith("recovered proof");
      const sharedAlias = change === "recovered proof with a shared host alias";
      const machine = canonicallyOwned(toolId);
      const target = machine.getNativeRegistrations(toolId)?.marketplaces[0];
      if (target === undefined) throw new Error("fixture lacks canonical catalogue");
      const otherRef = sharedAlias ? `sibling-plugin@${CATALOG}` : "aidd-dev@other-catalog";
      const staleRef = `obsolete-plugin@${CATALOG}`;
      const otherRoot = sharedAlias ? `/built/${toolId}` : "/other";
      const other = {
        alias: "other-alias",
        hostName: sharedAlias ? CATALOG : "other-catalog",
        provenance: {
          kind: "effective-list" as const,
          root: otherRoot,
          sourceType: "local",
          source: otherRoot,
        },
      };
      machine.setNativeRegistrations(toolId, {
        binary: toolId,
        marketplaces: [other, target],
        pluginRefs: [otherRef],
        pluginClaims: [
          { ref: otherRef, dependents: ["/B"] },
          { ref: PLUGIN_REF, dependents: ["/B"] },
        ],
      });
      let sourceReads = 0;
      const sourceReader: NativeMarketplaceSourceReader = {
        read: async () => {
          sourceReads += 1;
          if (sourceReads === 1)
            return { location: "host catalogue list", unreadable: "transient permissions error" };
          if (change === "missing source")
            return { location: "host catalogue list", entries: new Map() };
          const root = change === "foreign source" ? "/foreign/catalogue" : `/built/${toolId}`;
          return {
            location: "host catalogue list",
            entries: new Map([
              [CATALOG, { kind: "effective-list", root, sourceType: "local", source: root }],
            ]),
          };
        },
      };
      let registryReads = 0;
      const hostReader: HostPluginRegistryReader = {
        read: async () => {
          registryReads += 1;
          if (registryReads > 1 && change === "unreadable refs")
            return { location: "host plugin registry", unreadable: "permission denied" };
          const refs = new Map([
            [PLUGIN_REF, { enabled: true }],
            [otherRef, { enabled: true }],
          ]);
          if (registryReads > 1 && change === "foreign ref")
            refs.set(FOREIGN_REF, { enabled: true });
          return { location: "host plugin registry", refs };
        },
      };
      const f = makeSync(toolId, { machine, sourceReader, hostReader });
      if (sharedAlias) {
        await f.registry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name: other.alias,
            source: { kind: "local", path: "/framework" },
            scope: "user",
            addedAt: "2026-09-15T00:00:00Z",
          })
        );
        f.projectRepo
          .getCurrent()
          ?.addPlugin(
            toolId,
            InstalledPlugin.fromMetadata(
              "sibling-plugin",
              "1.0.0",
              { kind: "local", path: "/framework" },
              true,
              "project",
              other.alias
            )
          );
      }
      f.projectRepo.getCurrent()?.setNativeRegistrations(toolId, {
        binary: toolId,
        marketplaces: [other, target],
        pluginRefs: [otherRef, PLUGIN_REF, staleRef],
      });

      const result = await f.useCase.execute({
        projectRoot: PROJECT_ROOT,
        marketplaceNames: [CATALOG],
      });

      expect(result.errors).toEqual([]);
      expect(result.warnings.join(" ")).toContain("transient permissions error");
      expect(f.activator.addedMarketplaces).toEqual([]);
      expect(f.activator.removedMarketplaces).toEqual([]);
      expect(f.activator.enabledPlugins).toEqual([]);
      expect(f.activator.refreshedCatalogs).toEqual(recovered ? [CATALOG] : []);
      expect(f.projectRepo.getCurrent()?.getNativeRegistrations(toolId)).toEqual({
        binary: toolId,
        marketplaces: [other, target],
        pluginRefs:
          recovered && !sharedAlias ? [otherRef, PLUGIN_REF] : [otherRef, PLUGIN_REF, staleRef],
      });
      expect(f.machineRepo.getCurrent()?.getNativeRegistrations(toolId)).toEqual({
        binary: toolId,
        marketplaces: [other, target],
        pluginRefs: [otherRef],
        pluginClaims: [
          { ref: otherRef, dependents: ["/B"] },
          {
            ref: PLUGIN_REF,
            dependents: recovered ? ["/B", PROJECT_ROOT] : ["/B"],
          },
        ],
      });
      expect(f.machineRepo.saveCount).toBe(recovered ? 1 : 0);
      expect(f.fs.getFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
      expect(f.fs.getFile(HOST_CATALOG_WITNESS)).toBe(f.hostCatalogBytes);
    }
  );

  it("leaves a foreign same-name catalogue, ref, and cache untouched", async () => {
    const fixture = makeSync(toolId, {
      conflictOnAdd: true,
      hostRefs: new Map([[FOREIGN_REF, { enabled: true }]]),
    });

    const result = await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(fixture.activator.refreshedCatalogs).toEqual([]);
    expect(fixture.activator.removedMarketplaces).toEqual([]);
    expect(fixture.activator.addedMarketplaces).toEqual([]);
    expect(fixture.activator.enabledPlugins).toEqual([]);
    expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
    expect(await fixture.fs.readFile(HOST_CATALOG_WITNESS)).toBe(FOREIGN_CATALOG_BYTES);
    expect(fixture.machineRepo.getCurrent()).toBeNull();
    expect(result.warnings.join("\n")).toContain(CATALOG);
  });

  it("does not even re-add a same-name catalogue carrying a foreign ref", async () => {
    const fixture = makeSync(toolId, {
      hostRefs: new Map([[FOREIGN_REF, { enabled: true }]]),
    });

    const result = await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(fixture.activator.addedMarketplaces).toEqual([]);
    expect(fixture.activator.refreshedCatalogs).toEqual([]);
    expect(fixture.activator.enabledPlugins).toEqual([]);
    expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
    expect(await fixture.fs.readFile(HOST_CATALOG_WITNESS)).toBe(FOREIGN_CATALOG_BYTES);
    expect(result.warnings.join("\n")).toContain("legacy claim has no source proof");
  });

  it("refreshes only an exact canonically owned catalogue without foreign refs", async () => {
    const fixture = makeSync(toolId, { machine: canonicallyOwned(toolId) });

    await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(fixture.activator.refreshedCatalogs).toEqual([CATALOG]);
    expect(fixture.activator.enabledPlugins).toEqual([PLUGIN_REF]);
    expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
    expect(await fixture.fs.readFile(HOST_CATALOG_WITNESS)).toBe(fixture.hostCatalogBytes);
  });

  it("attaches A to the exact already-enabled machine claim without re-enabling or changing B's other claim", async () => {
    const machine = canonicallyOwned(toolId);
    const otherRef = "aidd-dev@other-catalog";
    const targetRegistration = {
      alias: CATALOG,
      hostName: CATALOG,
      provenance: {
        kind: "effective-list" as const,
        root: `/built/${toolId}`,
        sourceType: "local",
        source: `/built/${toolId}`,
      },
    };
    const otherRegistration = {
      alias: "other-alias",
      hostName: "other-catalog",
      provenance: {
        kind: "effective-list" as const,
        root: "/other",
        sourceType: "local",
        source: "/other",
      },
    };
    machine.setNativeRegistrations(toolId, {
      binary: toolId,
      marketplaces: [otherRegistration, targetRegistration],
      pluginRefs: [otherRef],
      pluginClaims: [
        { ref: otherRef, dependents: ["/B"] },
        { ref: PLUGIN_REF, dependents: ["/B"] },
      ],
    });
    const fixture = makeSync(toolId, {
      machine,
      hostRefs: new Map([
        [PLUGIN_REF, { enabled: true }],
        [otherRef, { enabled: true }],
        ["user-plugin@external-catalog", { enabled: true }],
      ]),
    });

    const result = await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(result.errors).toStrictEqual([]);
    expect(result.warnings).toStrictEqual([]);
    expect(fixture.activator.enabledPlugins).toStrictEqual([]);
    expect(fixture.activator.addedMarketplaces).toStrictEqual([]);
    expect(fixture.activator.removedMarketplaces).toStrictEqual([]);
    expect(fixture.activator.refreshedCatalogs).toStrictEqual([CATALOG]);
    expect(
      fixture.projectRepo.getCurrent()?.getNativeRegistrations(toolId)?.pluginRefs
    ).toStrictEqual([PLUGIN_REF]);
    expect(fixture.machineRepo.getCurrent()?.getNativeRegistrations(toolId)).toStrictEqual({
      binary: toolId,
      marketplaces: [otherRegistration, targetRegistration],
      pluginRefs: [otherRef],
      pluginClaims: [
        { ref: otherRef, dependents: ["/B"] },
        { ref: PLUGIN_REF, dependents: ["/B", PROJECT_ROOT] },
      ],
    });
    expect(fixture.fs.getFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
    expect(fixture.fs.getFile(HOST_CATALOG_WITNESS)).toBe(fixture.hostCatalogBytes);
  });

  it.each(["foreign source", "unreadable source", "foreign ref", "unreadable refs"] as const)(
    "does not refresh or enable after the host changes to %s during sync",
    async (change) => {
      let sourceReads = 0;
      let registryReads = 0;
      const sourceReader: NativeMarketplaceSourceReader = {
        read: async () => {
          sourceReads += 1;
          if (sourceReads > 1 && change === "unreadable source")
            return { location: "host catalogue list", unreadable: "permission denied" };
          const root =
            sourceReads > 1 && change === "foreign source"
              ? "/someone-elses/catalogue"
              : `/built/${toolId}`;
          return {
            location: "host catalogue list",
            entries: new Map([
              [
                CATALOG,
                {
                  kind: "effective-list" as const,
                  root,
                  sourceType: "local",
                  source: root,
                },
              ],
            ]),
          };
        },
      };
      const hostReader: HostPluginRegistryReader = {
        read: async () => {
          registryReads += 1;
          if (registryReads > 1 && change === "unreadable refs")
            return { location: "host plugin registry", unreadable: "permission denied" };
          return {
            location: "host plugin registry",
            refs: new Map(
              registryReads > 1 && change === "foreign ref"
                ? [[FOREIGN_REF, { enabled: true }]]
                : []
            ),
          };
        },
      };
      const fixture = makeSync(toolId, {
        machine: canonicallyOwned(toolId),
        sourceReader,
        hostReader,
      });

      await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(fixture.activator.addedMarketplaces).toEqual([]);
      expect(fixture.activator.removedMarketplaces).toEqual([]);
      expect(fixture.activator.refreshedCatalogs).toEqual([]);
      expect(fixture.activator.enabledPlugins).toEqual([]);
      expect(fixture.machineRepo.getCurrent()?.getNativeRegistrations(toolId)?.pluginRefs).toEqual(
        []
      );
      expect(
        fixture.machineRepo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims ?? []
      ).toEqual([{ ref: PLUGIN_REF, dependents: [PROJECT_ROOT] }]);
      expect(await fixture.fs.readFile(HOST_CATALOG_WITNESS)).toBe(fixture.hostCatalogBytes);
      expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
    }
  );

  it("refuses refresh when a foreign ref shares an AIDD-owned catalogue name", async () => {
    const fixture = makeSync(toolId, {
      machine: canonicallyOwned(toolId),
      hostRefs: new Map([[FOREIGN_REF, { enabled: true }]]),
    });

    const result = await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(fixture.activator.refreshedCatalogs).toEqual([]);
    expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
    expect(result.warnings.join("\n")).toContain(FOREIGN_REF);
  });

  it("does not treat a project-only native ref as machine ownership", async () => {
    const fixture = makeSync(toolId, {
      machine: canonicallyOwned(toolId),
      projectNativePluginRefs: [FOREIGN_REF],
      hostRefs: new Map([[FOREIGN_REF, { enabled: true }]]),
    });

    const result = await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(fixture.activator.refreshedCatalogs).toEqual([]);
    expect(fixture.activator.addedMarketplaces).toEqual([]);
    expect(fixture.activator.enabledPlugins).toEqual([]);
    expect(fixture.activator.removedMarketplaces).toEqual([]);
    expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
    expect(await fixture.fs.readFile(HOST_CATALOG_WITNESS)).toBe(fixture.hostCatalogBytes);
    expect(result.warnings.join("\n")).toContain(FOREIGN_REF);
  });

  it("activates a freshly added AIDD ref without a redundant refresh", async () => {
    const fixture = makeSync(toolId);

    await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(fixture.activator.addedMarketplaces).toEqual([`/built/${toolId}`]);
    expect(fixture.activator.enabledPlugins).toEqual([PLUGIN_REF]);
    expect(fixture.activator.refreshedCatalogs).toEqual([]);
    expect(fixture.machineRepo.getCurrent()?.getNativeRegistrations(toolId)?.marketplaces).toEqual([
      {
        alias: CATALOG,
        hostName: CATALOG,
        provenance: {
          kind: "effective-list",
          root: `/built/${toolId}`,
          sourceType: "local",
          source: `/built/${toolId}`,
        },
      },
    ]);
  });
});
