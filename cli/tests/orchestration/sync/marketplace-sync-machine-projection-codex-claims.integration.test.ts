import { describe, expect, it } from "vitest";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  builtPerMarketplace,
  catalogFile,
  freshNativeSources,
  fsWithProjects,
  manifestWithTool,
  pluginIn,
  readablePlugins,
  registryOf,
  singleCodexCatalog,
  wireSync,
} from "../testing/machine-projection.builder.js";

const { codex } = TOOL;

describe("native plugin claims recorded on the machine for Codex", () => {
  it("records a Codex plugin as machine-owned even when its marketplace source is project-local", async () => {
    const projectRoot = "/codex-project";
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
    const machine = manifestWithTool(codex);
    machine.setNativeRegistrations(codex, {
      binary: "codex",
      marketplaces: [older],
      pluginRefs: [otherRef],
      pluginClaims: [
        { ref: otherRef, dependents: ["/B"] },
        { ref, dependents: ["/B"] },
      ],
    });
    const activator = new FakeHostActions({ available: true });
    const { sync, fs, projectRepo, machineRepo } = await singleCodexCatalog({
      projectRoot,
      machine,
      activator,
    });
    fs.setSymlink(projectRoot, "/resolved-codex-project");

    const result = await sync.execute({ projectRoot });

    expect(result.activated).toEqual(["codex"]);
    expect(activator.enabledPlugins).toEqual([ref]);
    expect(projectRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginRefs).toEqual([ref]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
      { ref: otherRef, dependents: ["/B"] },
      { ref, dependents: ["/B", "/resolved-codex-project"] },
    ]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginRefs).toEqual([otherRef]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations(codex)?.marketplaces).toEqual([
      older,
      {
        alias: "local-catalog",
        hostName: "real-catalog",
        provenance: {
          kind: "effective-list",
          root: "/built/codex",
          sourceType: "local",
          source: "/built/codex",
        },
      },
    ]);

    await sync.execute({ projectRoot });
    expect(machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
      { ref: otherRef, dependents: ["/B"] },
      { ref, dependents: ["/B", "/resolved-codex-project"] },
    ]);
  });

  it("preserves another machine-owned marketplace claim during a narrowed sync", async () => {
    const projectRoot = "/codex-project";
    const project = manifestWithTool(codex);
    for (const alias of ["market-a", "market-b"]) {
      project.addPlugin(
        codex,
        pluginIn(alias, "project", `plugin-${alias.at(-1)}`, `/source/${alias}`)
      );
    }
    const projectRepo = new InMemoryManifestRepository(project);
    const machineRepo = new InMemoryManifestRepository(Manifest.create());
    const activator = new FakeHostActions({ available: true });
    const sync = wireSync({
      toolId: codex,
      fs: fsWithProjects({
        "/built/market-a/.agents/plugins/marketplace.json": catalogFile("real-a", ["plugin-a"]),
        "/built/market-b/.agents/plugins/marketplace.json": catalogFile("real-b", ["plugin-b"]),
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
      hostPluginRegistries: readablePlugins(codex),
      nativeSources: freshNativeSources(
        codex,
        activator,
        new Map([
          ["/built/market-a", "real-a"],
          ["/built/market-b", "real-b"],
        ])
      ),
    });

    await sync.execute({ projectRoot, marketplaceNames: ["market-b"] });
    await sync.execute({ projectRoot, marketplaceNames: ["market-a"] });

    expect(activator.enabledPlugins).toEqual(["plugin-b@real-b", "plugin-a@real-a"]);
    expect(projectRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginRefs).toEqual([
      "plugin-b@real-b",
      "plugin-a@real-a",
    ]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
      { ref: "plugin-b@real-b", dependents: [projectRoot] },
      { ref: "plugin-a@real-a", dependents: [projectRoot] },
    ]);
  });
});
