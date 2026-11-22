import { describe, expect, it } from "vitest";
import { registerMarketplacePlugin } from "../../../../../src/contexts/installation/application/materialize/register-marketplace-plugin.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import {
  buildDist,
  installViaModeA,
  PLUGIN_NAME,
  REF,
} from "../../testing/framework-plugin-on-claude.builder.js";
import {
  buildRemoveUseCase,
  NATIVE_PROJECT_ROOT as PROJECT_ROOT,
} from "../../testing/native-activation-removal.builder.js";

const { claude } = TOOL;

describe("RemovePlugin drives the host CLI the way install did", () => {
  it("uninstalls via the host CLI using the same <plugin>@<marketplace> ref install used", async () => {
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool(claude, "test", []);
    await installViaModeA(manifest, manifestRepo.records);
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([REF]);
    expect(logger.warnMessages).toEqual([]);
  });

  it("warns naming the host and leaves the removal complete when the CLI is not on PATH", async () => {
    const activator = new FakeHostActions({ available: false });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool(claude, "test", []);
    await installViaModeA(manifest, manifestRepo.records);
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(
      logger.warnMessages.some((message) => message.includes("claude") && message.includes(REF))
    ).toBe(true);
    const loaded = await manifestRepo.load();
    expect(loaded?.getPlugins(claude).some((p) => p.name === PLUGIN_NAME)).toBe(false);
    expect(manifestRepo.records.get(claude)?.pluginRefs).toEqual([REF]);
  });

  it("warns naming the host and message when the host CLI reports the plugin already absent", async () => {
    const activator = new FakeHostActions({
      available: true,
      failOnUninstall: [REF],
    });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool(claude, "test", []);
    await installViaModeA(manifest, manifestRepo.records);
    await manifestRepo.save(manifest);

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: [claude],
        projectRoot: PROJECT_ROOT,
      })
    ).resolves.not.toThrow();

    expect(
      logger.warnMessages.some((message) => message.includes("claude") && message.includes(REF))
    ).toBe(true);
  });

  it("never calls the host CLI for a plugin installed without a recorded marketplace", async () => {
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool(claude, "test", []);
    await registerMarketplacePlugin({
      dist: buildDist(),
      tool: registeredTools().aiProfile(claude),
      source: { kind: "local", path: "/plugin-source" },
      projectRoot: PROJECT_ROOT,
      manifest,
      marketplace: undefined,
    });
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(logger.warnMessages).toEqual([]);
  });

  // A real `claude` binary registers at its own implicit `"user"` default whatever scope the
  // manifest records for the plugin's files, and refuses an uninstall aimed at another scope.
  it("uses the host registry's exact user scope when the project manifest differs", async () => {
    const activator = new FakeHostActions({
      available: true,
      installedAtScope: new Map([[REF, "user"]]),
    });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger, "user");
    const manifest = Manifest.create();
    manifest.addTool(claude, "test", []);
    await installViaModeA(manifest, manifestRepo.records);
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([REF]);
    expect(activator.uninstalledPluginScopes).toEqual(["user"]);
    expect(logger.warnMessages).toEqual([]);
  });

  it("names the host, the ref and the host's answer when the host CLI refuses the uninstall", async () => {
    const activator = new FakeHostActions({
      available: true,
      failOnUninstall: [REF],
    });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool(claude, "test", []);
    await installViaModeA(manifest, manifestRepo.records);
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(logger.warnMessages).toContain(
      `claude plugin uninstall '${REF}' failed: plugin \`${REF}\` is not installed — an entry for it may remain in claude's own plugin registry.`
    );
  });

  it("propagates a failure that is not the host CLI refusing", async () => {
    const activator = new FakeHostActions({ available: true, crashOnUninstall: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool(claude, "test", []);
    await installViaModeA(manifest, manifestRepo.records);
    await manifestRepo.save(manifest);

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: [claude],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow("activator crashed uninstalling a plugin");
  });
});
