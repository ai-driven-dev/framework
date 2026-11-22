import { describe, expect, it, vi } from "vitest";
import { registerMarketplacePlugin } from "../../../../../src/contexts/installation/application/materialize/register-marketplace-plugin.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import {
  buildDist,
  installViaModeA,
  MARKETPLACE_NAME,
  PLUGIN_NAME,
  REF,
} from "../../testing/framework-plugin-on-claude.builder.js";
import {
  buildRemoveUseCase,
  NATIVE_PROJECT_ROOT as PROJECT_ROOT,
} from "../../testing/native-activation-removal.builder.js";
import { pluginRemover } from "../../testing/plugin-remover.builder.js";

const { claude } = TOOL;

describe("RemovePlugin proves the native source before undoing activation", () => {
  it("removes only the local projection when Claude CLI is unavailable and no native catalogue source was recorded", async () => {
    const fs = new InMemoryFileAdapter();
    const manifest = Manifest.create();
    manifest.addTool(claude, "test", []);
    await registerMarketplacePlugin({
      dist: buildDist(),
      tool: registeredTools().aiProfile(claude),
      source: { kind: "local", path: "/plugin-source" },
      projectRoot: PROJECT_ROOT,
      manifest,
      marketplace: MARKETPLACE_NAME,
    });
    const repo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
    const activator = new FakeHostActions({ available: false });
    const logger = new CapturingLogger();
    const removeUseCase = pluginRemover({
      fs,
      manifestRepo: repo,
      logger,
      activators: new Map([[claude, activator]]),
    });

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(repo.getCurrent()?.getPlugins(claude)).toEqual([]);
    expect(logger.warnMessages.join(" ")).toMatch(/CLI not found|host ref may remain/);
  });

  it("refuses an old AIDD catalogue claim when the current host source is foreign under the same name and ref", async () => {
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();
    const fs = new InMemoryFileAdapter();
    const manifestRepo = new InMemoryManifestRepository();
    const machine = Manifest.create();
    machine.addTool(claude, "test", []);
    const userRepo = new InMemoryManifestRepository(
      machine,
      undefined,
      new Map([
        [
          claude,
          {
            binary: "claude",
            marketplaces: [],
            pluginRefs: [REF],
            pluginClaims: [{ ref: REF, dependents: [PROJECT_ROOT] }],
          },
        ],
      ])
    );
    const removeUseCase = pluginRemover({
      fs,
      manifestRepo,
      logger,
      activators: new Map([[claude, activator]]),
      userManifestRepo: userRepo,
      nativeMarketplaceSources: new Map([
        [
          claude,
          {
            read: async () => ({
              location: "/host/catalogue",
              entries: new Map([
                [MARKETPLACE_NAME, { kind: "registry" as const, source: "/foreign/source" }],
              ]),
            }),
          },
        ],
      ]),
    });
    const manifest = Manifest.create();
    manifest.addTool(claude, "test", []);
    await installViaModeA(manifest, manifestRepo.records);
    manifestRepo.records.set(claude, {
      binary: "claude",
      marketplaces: [
        {
          alias: MARKETPLACE_NAME,
          hostName: MARKETPLACE_NAME,
          provenance: { kind: "registry", source: "/aidd/old-source" },
        },
      ],
      pluginRefs: [REF],
    });
    await manifestRepo.save(manifest);
    const savesBefore = manifestRepo.saveCount;
    const machineSavesBefore = userRepo.saveCount;
    const recordSavesBefore = manifestRepo.recordSaveCount;
    const machineRecordSavesBefore = userRepo.recordSaveCount;

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: [claude],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/source differs|reconcile manually/);

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(manifestRepo.saveCount).toBe(savesBefore);
    expect(userRepo.saveCount).toBe(machineSavesBefore);
    expect(manifestRepo.recordSaveCount).toBe(recordSavesBefore);
    expect(userRepo.recordSaveCount).toBe(machineRecordSavesBefore);
    expect(
      manifestRepo
        .getCurrent()
        ?.getPlugins(claude)
        .map((plugin) => plugin.name)
    ).toEqual([PLUGIN_NAME]);
    expect(manifestRepo.records.get(claude)?.pluginRefs).toEqual([REF]);
    expect(userRepo.records.get(claude)?.pluginClaims).toEqual([
      { ref: REF, dependents: [PROJECT_ROOT] },
    ]);
  });

  // The host call must address the host by `hostName`, read from this tool's own
  // `nativeRegistrations` - never by `plugin.marketplace`, a local alias a host never learns.
  it("uses the host's own name for the marketplace, read from this tool's own native registrations", async () => {
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
      marketplace: "local",
    });
    manifestRepo.records.set(claude, {
      binary: "claude",
      marketplaces: [
        {
          alias: "local",
          hostName: "upstream",
          provenance: { kind: "registry", source: "/plugin-source" },
        },
      ],
      pluginRefs: [`${PLUGIN_NAME}@upstream`],
    });
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([`${PLUGIN_NAME}@upstream`]);
  });

  it("refuses a legacy alias with no recorded native source before changing the project", async () => {
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool(claude, "test", []);
    await installViaModeA(manifest, manifestRepo.records);
    manifestRepo.records.set(claude, {
      binary: "claude",
      marketplaces: [{ alias: "some-other-marketplace", hostName: "other" }],
      pluginRefs: [],
    });
    await manifestRepo.save(manifest);

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: [claude],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/no recorded native catalogue source/);

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(manifestRepo.getCurrent()?.getPlugins(claude)).toHaveLength(1);
  });

  it("reads an unproved native registration only for preflight, not for uninstall or cache", async () => {
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool(claude, "test", []);
    await installViaModeA(manifest, manifestRepo.records);
    manifestRepo.records.set(claude, {
      binary: "claude",
      marketplaces: [{ alias: "some-other-marketplace", hostName: "other" }],
      pluginRefs: [],
    });
    await manifestRepo.save(manifest);
    const spy = vi.spyOn(manifestRepo, "loadRecords");

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: [claude],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/no recorded native catalogue source/);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("logs nothing when this tool's own native registrations name the alias", async () => {
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool(claude, "test", []);
    await installViaModeA(manifest, manifestRepo.records);
    manifestRepo.records.set(claude, {
      binary: "claude",
      marketplaces: [
        {
          alias: MARKETPLACE_NAME,
          hostName: "upstream",
          provenance: { kind: "registry", source: "/plugin-source" },
        },
      ],
      pluginRefs: [`${PLUGIN_NAME}@upstream`],
    });
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toStrictEqual([`${PLUGIN_NAME}@upstream`]);
    expect(logger.warnMessages).toStrictEqual([]);
  });
});
