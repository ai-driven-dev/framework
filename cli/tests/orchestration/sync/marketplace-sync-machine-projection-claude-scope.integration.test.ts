import { describe, expect, it } from "vitest";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import {
  SYNTHETIC_TOOL,
  syntheticNativeCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";
import {
  builtPerMarketplace,
  catalogFile,
  freshNativeSources,
  fsWithProjects,
  hostCatalogs,
  manifestWithTool,
  projectWithPlugin,
  readablePlugins,
  registryOf,
  wireSync,
} from "../testing/machine-projection.builder.js";

const tool = SYNTHETIC_TOOL;

type Mode = "fresh" | "existing project proof" | "existing machine proof";

const ALIAS = "local-catalog";
const HOST_NAME = "real-catalog";
const REF = `test-plugin@${HOST_NAME}`;
const OTHER_REF = "owned-other@other-catalog";
const OTHER_REGISTRATION = {
  alias: "other",
  hostName: "other-catalog",
  provenance: { kind: "registry" as const, source: `/other/${tool}` },
};
const REGISTRATION = {
  alias: ALIAS,
  hostName: HOST_NAME,
  provenance: { kind: "registry" as const, source: `/built/${tool}` },
};

function existingProofRecords(mode: Mode) {
  const projectHolds = mode === "existing project proof";
  return {
    project: new Map([
      [
        tool,
        {
          binary: tool,
          marketplaces: projectHolds ? [OTHER_REGISTRATION, REGISTRATION] : [],
          pluginRefs: [REF],
        },
      ],
    ]),
    machine: new Map([
      [
        tool,
        {
          binary: tool,
          marketplaces: projectHolds ? [OTHER_REGISTRATION] : [OTHER_REGISTRATION, REGISTRATION],
          pluginRefs: [OTHER_REF],
          pluginClaims: [{ ref: OTHER_REF, dependents: ["/B"] }],
        },
      ],
    ]),
  };
}

/** The host's own record, as it reads once a catalogue and plugins already exist there. */
function existingHostRecord() {
  const catalogs = hostCatalogs(
    tool,
    new Map([
      [HOST_NAME, `/built/${tool}`],
      ["other-catalog", `/other/${tool}`],
    ])
  );
  const plugins = readablePlugins(
    tool,
    new Map([
      [REF, { enabled: true, scope: "project" }],
      [OTHER_REF, { enabled: true, scope: "user" }],
      ["test-plugin@external-catalog", { enabled: true, scope: "user" }],
    ])
  );
  const known = new Map([
    [HOST_NAME, REGISTRATION.provenance],
    ["other-catalog", OTHER_REGISTRATION.provenance],
  ]);
  return { catalogs, plugins, known };
}

async function catalogueScope(mode: Mode) {
  const fresh = mode === "fresh";
  const project = projectWithPlugin(tool, ALIAS);
  const machine = fresh ? Manifest.create() : manifestWithTool(tool);
  const seeded = fresh ? undefined : existingProofRecords(mode);
  const projectRepo = new InMemoryManifestRepository(project, undefined, seeded?.project);
  const machineRepo = new InMemoryManifestRepository(machine, undefined, seeded?.machine);
  const activator = new FakeHostActions({ available: true });
  const existing = existingHostRecord();
  const sync = wireSync({
    tools: syntheticNativeCatalog(tool),
    toolId: tool,
    fs: fsWithProjects({
      [`/built/${tool}/.plugin/marketplace.json`]: catalogFile(HOST_NAME, ["test-plugin"]),
    }),
    projectRepo,
    machineRepo,
    registry: await registryOf("/project", { name: ALIAS, scope: "user" }),
    activator,
    hostMarketplaceRegistries: fresh ? hostCatalogs(tool) : existing.catalogs,
    hostPluginRegistries: fresh ? readablePlugins(tool) : existing.plugins,
    nativeSources: freshNativeSources(
      tool,
      activator,
      new Map([[`/built/${tool}`, HOST_NAME]]),
      fresh ? new Map() : existing.known
    ),
  });
  return { sync, activator, projectRepo, machineRepo };
}

type CatalogueScope = Awaited<ReturnType<typeof catalogueScope>>;

function expectHostWrites({ activator }: CatalogueScope, fresh: boolean) {
  expect(activator.enabledPlugins).toEqual(fresh ? [REF] : []);
  expect(activator.enabledPluginScopes).toEqual(fresh ? ["project"] : []);
  expect(activator.addedMarketplaces).toStrictEqual(fresh ? [`/built/${tool}`] : []);
  expect(activator.removedMarketplaces).toStrictEqual([]);
}

function expectMachineRecord({ machineRepo }: CatalogueScope, fresh: boolean) {
  const recorded = machineRepo.records.get(tool);
  expect(recorded?.marketplaces).toEqual(
    fresh ? [REGISTRATION] : [OTHER_REGISTRATION, REGISTRATION]
  );
  expect(recorded?.pluginClaims ?? []).toEqual(
    fresh ? [] : [{ ref: OTHER_REF, dependents: ["/B"] }]
  );
  if (!fresh) expect(recorded?.pluginRefs).toStrictEqual([OTHER_REF]);
}

describe("native plugin ownership follows the host's Claude activation scope", () => {
  it.each(["fresh", "existing project proof", "existing machine proof"] as const)(
    "records a user-scope Claude catalogue without claiming its project-local plugin: %s",
    async (mode) => {
      const fixture = await catalogueScope(mode);

      const result = await fixture.sync.execute({ projectRoot: "/project" });

      expect(result.activated).toEqual([tool]);
      expect(result.errors).toStrictEqual([]);
      expect(result.warnings).toStrictEqual([]);
      expectHostWrites(fixture, mode === "fresh");
      expect(fixture.projectRepo.records.get(tool)?.pluginRefs).toEqual([REF]);
      expectMachineRecord(fixture, mode === "fresh");
    }
  );

  it("claims a Claude plugin enabled at user scope without inventing a project dependent", async () => {
    const alias = "user-catalog";
    const userRepo = new InMemoryManifestRepository(projectWithPlugin(tool, alias, "user"));
    const projectRepo = new InMemoryManifestRepository(Manifest.create());
    const activator = new FakeHostActions({ available: true });
    const sync = wireSync({
      tools: syntheticNativeCatalog(tool),
      toolId: tool,
      fs: fsWithProjects({
        [`/built/${tool}/.plugin/marketplace.json`]: catalogFile("real-catalog", ["test-plugin"]),
      }),
      projectRepo,
      machineRepo: userRepo,
      registry: await registryOf("/project", { name: alias, scope: "user" }),
      activator,
      hostMarketplaceRegistries: hostCatalogs(tool),
      hostPluginRegistries: readablePlugins(tool),
      nativeSources: freshNativeSources(
        tool,
        activator,
        new Map([[`/built/${tool}`, "real-catalog"]])
      ),
    });

    const result = await sync.execute({ projectRoot: "/project", scope: "user" });

    expect(result.errors).toEqual([]);
    expect(activator.enabledPlugins).toEqual(["test-plugin@real-catalog"]);
    expect(activator.enabledPluginScopes).toEqual(["user"]);
    expect(userRepo.records.get(tool)?.marketplaces).toEqual([
      {
        alias,
        hostName: "real-catalog",
        provenance: { kind: "registry", source: `/built/${tool}` },
      },
    ]);
    expect(userRepo.records.get(tool)?.pluginClaims).toEqual([
      { ref: "test-plugin@real-catalog", dependents: [] },
    ]);
    expect(projectRepo.records.get(tool)).toBeUndefined();
  });

  it("records only the user-scope marketplace in the machine manifest when a project syncs both scopes", async () => {
    const projectRepo = new InMemoryManifestRepository(manifestWithTool(tool));
    const machineRepo = new InMemoryManifestRepository(Manifest.create());
    const activator = new FakeHostActions({ available: true });
    const sync = wireSync({
      tools: syntheticNativeCatalog(tool),
      toolId: tool,
      fs: fsWithProjects({
        "/built/user-alias/.plugin/marketplace.json": catalogFile("real-user", []),
        "/built/project-alias/.plugin/marketplace.json": catalogFile("real-project", []),
      }),
      projectRepo,
      machineRepo,
      registry: await registryOf(
        "/project",
        { name: "user-alias", scope: "user", path: "/source/user-alias" },
        { name: "project-alias", scope: "project", path: "/source/project-alias" }
      ),
      activator,
      ensureBuilt: builtPerMarketplace,
      hostMarketplaceRegistries: hostCatalogs(tool),
      hostPluginRegistries: readablePlugins(tool),
      nativeSources: freshNativeSources(
        tool,
        activator,
        new Map([
          ["/built/user-alias", "real-user"],
          ["/built/project-alias", "real-project"],
        ])
      ),
    });

    const result = await sync.execute({ projectRoot: "/project" });

    expect(result.errors).toEqual([]);
    const projectMarketplaces = projectRepo.records.get(tool)?.marketplaces;
    expect(projectMarketplaces).toHaveLength(2);
    expect(projectMarketplaces).toEqual(
      expect.arrayContaining([
        {
          alias: "user-alias",
          hostName: "real-user",
          provenance: { kind: "registry", source: "/built/user-alias" },
        },
        {
          alias: "project-alias",
          hostName: "real-project",
          provenance: { kind: "registry", source: "/built/project-alias" },
        },
      ])
    );
    expect(machineRepo.records.get(tool)?.marketplaces).toEqual([
      {
        alias: "user-alias",
        hostName: "real-user",
        provenance: { kind: "registry", source: "/built/user-alias" },
      },
    ]);
  });
});
