import { realpathSync } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordsOf, wireInstallation } from "../../src/composition/contexts/installation.js";
import { wireMarketplace } from "../../src/composition/orchestration/marketplace.js";
import { wirePlugin } from "../../src/composition/orchestration/plugin.js";
import { wireBase } from "../../src/composition/shared.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../src/contexts/distribution/contract/marketplace.js";
import { hostPortsOver } from "../../src/contexts/host-registration/application/host-ports-over.js";
import { WithdrawFromHost } from "../../src/contexts/host-registration/application/withdraw/withdraw-from-host.use-case.js";
import type { HostRefusal } from "../../src/contexts/host-registration/domain/native-refusal.js";
import { Manifest } from "../../src/contexts/installation/domain/manifest.js";
import { FileHash } from "../../src/shared/domain/file-hash.js";
import type { Scope } from "../../src/shared/domain/scope.js";
import { FakeHostMarketplaceSources } from "../contexts/host-registration/testing/fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { catalogOf } from "../shared/testing/catalog-of.builder.js";
import { FakeHostActions } from "../shared/testing/fake-host-actions.fake.js";
import { TOOL } from "../shared/testing/registered-tools.builder.js";
import { containerOf, stubMachineEnv } from "./testing/container-graph.builder.js";

// A host records the real location of a source it was given, never a symlinked temp path.
class RealpathHostActions extends FakeHostActions {
  override addMarketplace(source: string, scope?: Scope): HostRefusal {
    return super.addMarketplace(realpathSync.native(source), scope);
  }
}

const FRAMEWORK = join(process.cwd(), "tests/fixtures/framework");
const SETTINGS = ".claude/settings.json";

describe("removing a plugin and its marketplace", () => {
  let root: string;
  let project: string;
  let container: Awaited<ReturnType<typeof containerOf>>;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-removal-"));
    stubMachineEnv(root);
    project = join(root, "project");
    await mkdir(project, { recursive: true });
    container = await containerOf(project, { verbose: false }, undefined, catalogOf());
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    await container.shared.manifestRepo.save(manifest);
    await container.marketplace.addMarketplace.execute({
      source: { kind: "local", path: FRAMEWORK },
      name: "local",
      scope: "project",
      projectRoot: project,
      autoTrust: true,
      overwrite: false,
    });
    await container.plugin.installPlugin.execute({
      pluginArg: "aidd-test",
      toolIds: [TOOL.claude],
      projectRoot: project,
      interactive: false,
      fromMarketplace: "local",
      yes: true,
      scope: undefined,
    });
    await container.marketplace.syncNativeActivation.execute({
      projectRoot: project,
      marketplaceNames: ["local"],
    });
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  const exists = (path: string) =>
    access(join(project, path)).then(
      () => true,
      () => false
    );

  it("leaves no enabled-plugin entry once the plugin is removed", async () => {
    const before = JSON.parse(await readFile(join(project, SETTINGS), "utf8"));
    expect(before.enabledPlugins).toHaveProperty("aidd-test@local");

    await container.plugin.removePlugin.execute({
      pluginName: "aidd-test",
      toolIds: "all",
      projectRoot: project,
    });

    const content = await readFile(join(project, SETTINGS), "utf8");
    expect(JSON.parse(content).enabledPlugins ?? {}).not.toHaveProperty("aidd-test@local");
    const manifest = await container.shared.manifestRepo.load();
    const tracked = manifest?.getToolFiles(TOOL.claude).find((f) => f.relativePath === SETTINGS);
    expect(tracked?.hash.toString()).toBe(FileHash.of(content).toString());
  });

  it("leaves no built cache once the marketplace is removed", async () => {
    expect(await exists(".aidd/cache/built/local")).toBe(true);

    await container.marketplace.removeProjectMarketplace.execute({
      name: "local",
      projectRoot: project,
      autoConfirm: true,
    });

    expect(await exists(".aidd/cache/built/local")).toBe(false);
  });
});

describe("removing a project marketplace a host declared", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-removal-host-"));
    stubMachineEnv(root);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it("withdraws the host's declaration at project scope and forgets it from the record", async () => {
    const host = new RealpathHostActions({ available: true });
    const base = wireBase({ projectRoot: root, verbose: false, tools: catalogOf() });
    const rules = recordsOf(base.manifestRepo);
    const nativePluginActivators = new Map([["claude", host]]);
    const hostPluginRegistries = new Map([
      [TOOL.claude, new FakeHostPluginRegistry({ location: "fake host", refs: new Map() })],
    ]);
    const nativeSources = new Map([
      [
        TOOL.claude,
        new FakeHostMarketplaceSources(
          host,
          "registry",
          () => FRAMEWORK_MARKETPLACE_NAME,
          new Map()
        ),
      ],
    ]);
    const withHost = {
      ...base,
      nativePluginActivators,
      hostPluginRegistries,
      nativeSources,
      withdrawFromHost: new WithdrawFromHost(
        base.fs,
        base.logger,
        hostPortsOver({
          activators: nativePluginActivators,
          pluginRegistries: hostPluginRegistries,
          marketplaceRegistries: base.hostMarketplaceRegistries,
          sources: nativeSources,
        })
      ),
    };
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    await base.manifestRepo.save(manifest);
    const installation = wireInstallation(withHost);
    const { addMarketplace, syncNativeActivation, removeProjectMarketplace } = wireMarketplace(
      withHost,
      installation
    );
    const { installPlugin } = wirePlugin(withHost, installation);
    await addMarketplace.execute({
      source: { kind: "local", path: FRAMEWORK },
      name: "local",
      scope: "project",
      projectRoot: root,
      autoTrust: true,
      overwrite: false,
    });
    await installPlugin.execute({
      pluginArg: "aidd-test",
      toolIds: [TOOL.claude],
      projectRoot: root,
      interactive: false,
      fromMarketplace: "local",
      yes: true,
      scope: undefined,
    });
    await syncNativeActivation.execute({ projectRoot: root, marketplaceNames: ["local"] });
    expect(host.addedMarketplaces).toHaveLength(1);
    const recorded = async () => {
      const record = (await base.manifestRepo.loadRecords()).get(TOOL.claude);
      return record === undefined ? undefined : rules.marketplaceOf(record, "local");
    };
    expect(await recorded()).toBeDefined();

    await removeProjectMarketplace.execute({ name: "local", projectRoot: root, autoConfirm: true });

    expect(host.removedMarketplaces).toEqual([FRAMEWORK_MARKETPLACE_NAME]);
    expect(host.removedMarketplaceScopes).toEqual(["project"]);
    expect(await recorded()).toBeUndefined();
  });
});
