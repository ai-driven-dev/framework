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
  manifestWithTool,
  pluginIn,
  readablePlugins,
  registryOf,
  singleListedCatalog,
  wireSync,
} from "../testing/machine-projection.builder.js";

const tool = SYNTHETIC_TOOL;

describe("native plugin claims recorded on the machine for Codex", () => {
  it("records a Codex plugin as machine-owned even when its marketplace source is project-local", async () => {
    const projectRoot = "/listed-project";
    const ref = "test-plugin@real-catalog";
    const otherRef = "unrelated-plugin@older-catalog";
    const older = {
      alias: "local-catalog",
      hostName: "older-catalog",
      provenance: {
        kind: "effective-list" as const,
        root: "/older",
        sourceType: "local",
        source: "/older",
      },
    };
    const machine = manifestWithTool(tool);
    machine.setNativeRegistrations(tool, {
      binary: tool,
      marketplaces: [older],
      pluginRefs: [otherRef],
      pluginClaims: [
        { ref: otherRef, dependents: ["/B"] },
        { ref, dependents: ["/B"] },
      ],
    });
    const activator = new FakeHostActions({ available: true });
    const { sync, fs, projectRepo, machineRepo } = await singleListedCatalog({
      tools: syntheticNativeCatalog(tool, "list-command"),
      tool,
      projectRoot,
      machine,
      activator,
    });
    fs.setSymlink(projectRoot, "/resolved-listed-project");

    const result = await sync.execute({ projectRoot });

    expect(result.activated).toEqual([tool]);
    expect(activator.enabledPlugins).toEqual([ref]);
    expect(projectRepo.getCurrent()?.getNativeRegistrations(tool)?.pluginRefs).toEqual([ref]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations(tool)?.pluginClaims).toEqual([
      { ref: otherRef, dependents: ["/B"] },
      { ref, dependents: ["/B", "/resolved-listed-project"] },
    ]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations(tool)?.pluginRefs).toEqual([otherRef]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations(tool)?.marketplaces).toEqual([
      older,
      {
        alias: "local-catalog",
        hostName: "real-catalog",
        provenance: {
          kind: "effective-list",
          root: `/built/${tool}`,
          sourceType: "local",
          source: `/built/${tool}`,
        },
      },
    ]);

    await sync.execute({ projectRoot });
    expect(machineRepo.getCurrent()?.getNativeRegistrations(tool)?.pluginClaims).toEqual([
      { ref: otherRef, dependents: ["/B"] },
      { ref, dependents: ["/B", "/resolved-listed-project"] },
    ]);
  });

  it("preserves another machine-owned marketplace claim during a narrowed sync", async () => {
    const projectRoot = "/listed-project";
    const project = manifestWithTool(tool);
    for (const alias of ["market-a", "market-b"]) {
      project.addPlugin(
        tool,
        pluginIn(alias, "project", `plugin-${alias.at(-1)}`, `/source/${alias}`)
      );
    }
    const projectRepo = new InMemoryManifestRepository(project);
    const machineRepo = new InMemoryManifestRepository(Manifest.create());
    const activator = new FakeHostActions({ available: true });
    const sync = wireSync({
      tools: syntheticNativeCatalog(tool, "list-command"),
      toolId: tool,
      fs: fsWithProjects({
        "/built/market-a/.plugin/marketplace.json": catalogFile("real-a", ["plugin-a"]),
        "/built/market-b/.plugin/marketplace.json": catalogFile("real-b", ["plugin-b"]),
      }),
      projectRepo,
      machineRepo,
      registry: await registryOf(
        projectRoot,
        { name: "market-a", scope: "project", path: "/source/market-a" },
        { name: "market-b", scope: "project", path: "/source/market-b" }
      ),
      activator,
      ensureBuilt: builtPerMarketplace,
      hostPluginRegistries: readablePlugins(tool),
      nativeSources: freshNativeSources(
        tool,
        activator,
        new Map([
          ["/built/market-a", "real-a"],
          ["/built/market-b", "real-b"],
        ]),
        new Map(),
        "effective-list"
      ),
    });

    await sync.execute({ projectRoot, marketplaceNames: ["market-b"] });
    await sync.execute({ projectRoot, marketplaceNames: ["market-a"] });

    expect(activator.enabledPlugins).toEqual(["plugin-b@real-b", "plugin-a@real-a"]);
    expect(projectRepo.getCurrent()?.getNativeRegistrations(tool)?.pluginRefs).toEqual([
      "plugin-b@real-b",
      "plugin-a@real-a",
    ]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations(tool)?.pluginClaims).toEqual([
      { ref: "plugin-b@real-b", dependents: [projectRoot] },
      { ref: "plugin-a@real-a", dependents: [projectRoot] },
    ]);
  });
});
