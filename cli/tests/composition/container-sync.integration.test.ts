import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { wireInstallation } from "../../src/composition/contexts/installation.js";
import { wireMarketplace } from "../../src/composition/orchestration/marketplace.js";
import { wireBase } from "../../src/composition/shared.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../src/contexts/distribution/contract/marketplace.js";
import type { HostRefusal } from "../../src/contexts/host-registration/domain/native-refusal.js";
import { Manifest } from "../../src/contexts/installation/domain/manifest.js";
import { BUILT_CACHE_SUBDIR } from "../../src/shared/domain/layout/aidd-layout.js";
import { FakeHostMarketplaceSources } from "../contexts/host-registration/testing/fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { catalogOf } from "../shared/testing/catalog-of.builder.js";
import { FakeHostActions } from "../shared/testing/fake-host-actions.fake.js";
import { hostRecord } from "../shared/testing/host-record-reading.builder.js";
import { TOOL } from "../shared/testing/registered-tools.builder.js";
import { graphOf, SAMPLE_MARKETPLACE, stubMachineEnv } from "./testing/container-graph.builder.js";

// A host records the real location of a source it was given, never a symlinked temp path:
// the native resolution, which also expands a Windows short name the way `fs.realpath` does.
class RealpathHostActions extends FakeHostActions {
  override addMarketplace(source: string, scope?: unknown): HostRefusal {
    return super.addMarketplace(realpathSync.native(source), scope);
  }
}

function hostedFramework(tools: ReturnType<typeof catalogOf>, root: string) {
  const activator = new RealpathHostActions({ available: true });
  const base = wireBase({ projectRoot: root, verbose: false, tools });
  const withHost = {
    ...base,
    nativePluginActivators: new Map([["claude", activator]]),
    hostPluginRegistries: new Map([
      [TOOL.claude, new FakeHostPluginRegistry({ location: "fake host", refs: new Map() })],
    ]),
    nativeSources: new Map([
      [
        TOOL.claude,
        new FakeHostMarketplaceSources(
          activator,
          "registry",
          () => FRAMEWORK_MARKETPLACE_NAME,
          new Map()
        ),
      ],
    ]),
  };
  const { syncSettings } = wireMarketplace(withHost, wireInstallation(withHost));
  return { activator, base, syncSettings };
}

describe("the settings sync a container wires", () => {
  const tools = catalogOf();
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-create-deps-"));
    stubMachineEnv(root);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it("purges this project's pre-migration copy once sync finds the framework at user scope", async () => {
    const { registerFrameworkMarketplace, manifestRepo, syncSettings } = await graphOf(
      root,
      { verbose: false },
      undefined,
      tools
    );
    await registerFrameworkMarketplace.execute({
      projectRoot: root,
      pluginSource: { kind: "local", path: SAMPLE_MARKETPLACE },
    });
    await manifestRepo.save(Manifest.create());
    const preMigration = join(root, BUILT_CACHE_SUBDIR, FRAMEWORK_MARKETPLACE_NAME);
    await mkdir(preMigration, { recursive: true });

    await syncSettings.execute({
      projectRoot: root,
      recreateFrameworkIfMissing: true,
    });

    expect(existsSync(preMigration)).toBe(false);
  });

  it("moves a project-scope framework entry to the machine when sync recreates the framework", async () => {
    const { registerFrameworkMarketplace, manifestRepo, syncSettings } = await graphOf(
      root,
      { verbose: false },
      undefined,
      tools
    );
    await registerFrameworkMarketplace.execute({
      projectRoot: root,
      pluginSource: { kind: "local", path: SAMPLE_MARKETPLACE },
    });
    const userEntries = join(root, "user-config", "marketplaces.json");
    const projectEntries = join(root, ".aidd", "marketplaces.json");
    await mkdir(join(root, ".aidd"), { recursive: true });
    await writeFile(projectEntries, await readFile(userEntries, "utf8"));
    await rm(userEntries);
    await manifestRepo.save(Manifest.create());

    await syncSettings.execute({
      projectRoot: root,
      recreateFrameworkIfMissing: true,
    });

    expect(await readFile(projectEntries, "utf8")).not.toContain(FRAMEWORK_MARKETPLACE_NAME);
    expect(await readFile(userEntries, "utf8")).toContain(FRAMEWORK_MARKETPLACE_NAME);
  });

  it("registers the framework marketplace with the host and enables its plugins through the host's own registries", async () => {
    const { activator, base, syncSettings } = hostedFramework(tools, root);
    await base.registerFrameworkMarketplace.execute({
      projectRoot: root,
      pluginSource: {
        kind: "local",
        path: join(process.cwd(), "tests/fixtures/framework"),
      },
    });
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    await base.manifestRepo.save(manifest);

    await syncSettings.execute({
      projectRoot: root,
      enablePlugins: ["aidd-test"],
    });

    expect(activator.addedMarketplaces).toHaveLength(1);
    expect(activator.enabledPlugins).toEqual([`aidd-test@${FRAMEWORK_MARKETPLACE_NAME}`]);
  });

  it("leaves the recorded manifests untouched when a second sync finds the host as recorded", async () => {
    const { base, syncSettings } = hostedFramework(tools, root);
    await base.registerFrameworkMarketplace.execute({
      projectRoot: root,
      pluginSource: {
        kind: "local",
        path: join(process.cwd(), "tests/fixtures/framework"),
      },
    });
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    await base.manifestRepo.save(manifest);
    await syncSettings.execute({ projectRoot: root, enablePlugins: ["aidd-test"] });
    const projectSaves = vi.spyOn(base.manifestRepo, "save");
    const projectRecordSaves = vi.spyOn(base.manifestRepo, "saveRecords");
    const machineSaves = vi.spyOn(base.userManifestRepo, "save");
    const machineRecordSaves = vi.spyOn(base.userManifestRepo, "saveRecords");

    await syncSettings.execute({ projectRoot: root, enablePlugins: ["aidd-test"] });

    expect(projectSaves).not.toHaveBeenCalled();
    expect(projectRecordSaves).not.toHaveBeenCalled();
    expect(machineSaves).not.toHaveBeenCalled();
    expect(machineRecordSaves).not.toHaveBeenCalled();
  });

  it("replaces a recorded source that no longer matches what the host holds", async () => {
    const { base, syncSettings } = hostedFramework(tools, root);
    await base.registerFrameworkMarketplace.execute({
      projectRoot: root,
      pluginSource: {
        kind: "local",
        path: join(process.cwd(), "tests/fixtures/framework"),
      },
    });
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    await base.manifestRepo.save(manifest);
    await syncSettings.execute({ projectRoot: root, enablePlugins: ["aidd-test"] });
    const records = await base.manifestRepo.loadRecords();
    const recorded = hostRecord(records.get(TOOL.claude));
    if (recorded === undefined) throw new Error("the first sync recorded nothing");
    records.set(TOOL.claude, {
      ...recorded,
      marketplaces: recorded.marketplaces.map((entry) => ({
        ...entry,
        provenance: { kind: "registry", source: "elsewhere" },
      })),
    });
    await base.manifestRepo.saveRecords(records);

    await syncSettings.execute({ projectRoot: root, enablePlugins: ["aidd-test"] });

    expect((await base.manifestRepo.loadRecords()).get(TOOL.claude)?.marketplaces).toEqual(
      recorded.marketplaces
    );
  });
});
