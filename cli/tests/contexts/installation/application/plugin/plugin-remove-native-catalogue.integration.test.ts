import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeHostPluginRegistry } from "../../testing/fake-host-plugin-registry.fake.js";
import { aManifest } from "../../testing/manifest.builder.js";
import { pluginRemover } from "../../testing/plugin-remover.builder.js";

import {
  aMachineWithClaudeAndCursor,
  anInstalledPlugin,
  SELECTED_PLUGIN,
  SELECTION_OTHER_ROOT,
  SELECTION_ROOT,
} from "../../testing/plugin-selection-scenario.builder.js";

const { claude, cursor, codex } = TOOL;

describe("native removal preserves unconfirmed refs and addresses the recorded catalogue", () => {
  const ALIAS = "local-alias";
  const HOST = "host-catalogue";
  const REF = `${SELECTED_PLUGIN}@${HOST}`;
  const FOREIGN = `other-plugin@${HOST}`;
  const provenance = { kind: "registry" as const, source: "/plugin-source" };

  function fixture(
    options: {
      available?: boolean;
      fail?: boolean;
      enabled?: boolean;
      registrations?: boolean;
    } = {}
  ) {
    const record = aMachineWithClaudeAndCursor();
    record.addPlugin(
      claude,
      anInstalledPlugin({ scope: "project", marketplace: ALIAS, files: { "owned.md": "digest" } })
    );
    record.addPlugin(
      claude,
      anInstalledPlugin({ name: "other-plugin", scope: "project", marketplace: "other-alias" })
    );
    if (options.registrations !== false)
      record.setNativeRegistrations(claude, {
        binary: "claude",
        marketplaces: [
          { alias: "other-alias", hostName: "other-host", provenance },
          { alias: ALIAS, hostName: HOST, provenance },
        ],
        pluginRefs: options.enabled === false ? [FOREIGN] : [FOREIGN, REF],
      });
    const fs = new InMemoryFileAdapter({ [join(SELECTION_ROOT, "owned.md")]: "owned" });
    const cache = join(
      homedir(),
      ".claude",
      "plugins",
      "cache",
      HOST,
      SELECTED_PLUGIN,
      "1.0.0",
      "plugin.json"
    );
    const foreignCache = join(
      homedir(),
      ".claude",
      "plugins",
      "cache",
      HOST,
      "other-plugin",
      "1.0.0",
      "plugin.json"
    );
    fs.setFile(cache, "target cache");
    fs.setFile(foreignCache, "foreign cache");
    const activator = new FakeHostActions({
      available: options.available ?? true,
      failOnUninstall: options.fail ? [REF] : [],
    });
    const logger = new CapturingLogger();
    const repo = new InMemoryManifestRepository(record, SELECTION_ROOT);
    const remove = pluginRemover({
      fs,
      manifestRepo: repo,
      logger,
      activators: new Map([[claude, activator]]),
      hostPluginRegistries: new Map([
        [
          claude,
          new FakeHostPluginRegistry({
            location: "/host/registry",
            refs: new Map([[REF, { enabled: true, scope: "project" }]]),
          }),
        ],
      ]),
      nativeMarketplaceSources: new Map([
        [
          claude,
          {
            read: async () => ({
              location: "/host/catalogues",
              entries: new Map([[HOST, provenance]]),
            }),
          },
        ],
      ]),
    });
    return { record, fs, cache, foreignCache, activator, logger, repo, remove };
  }

  it("removes the exact confirmed ref and cache while preserving sibling registrations", async () => {
    const f = fixture();
    const marketplaces = f.record.getNativeRegistrations(claude)?.marketplaces;

    await f.remove.execute({
      pluginName: SELECTED_PLUGIN,
      toolIds: [claude],
      projectRoot: SELECTION_ROOT,
    });

    expect(f.activator.uninstalledPlugins).toEqual([REF]);
    expect(f.activator.uninstalledPluginScopes).toEqual(["project"]);
    expect(f.record.getNativeRegistrations(claude)?.pluginRefs).toEqual([FOREIGN]);
    expect(f.record.getNativeRegistrations(claude)?.marketplaces).toEqual(marketplaces);
    expect(f.record.getPlugins(claude).map((entry) => entry.name)).toEqual(["other-plugin"]);
    expect(await f.fs.fileExists(f.cache)).toBe(false);
    expect(f.fs.getFile(f.foreignCache)).toBe("foreign cache");
    expect(await f.fs.fileExists(join(SELECTION_ROOT, "owned.md"))).toBe(false);
    expect(f.logger.infoMessages).toEqual([
      `claude: cache for '${SELECTED_PLUGIN}' purged: ${join(homedir(), ".claude", "plugins", "cache", HOST, SELECTED_PLUGIN)}`,
    ]);
    expect(f.logger.warnMessages).toEqual([]);
    expect(f.repo.saveCount).toBe(1);
  });

  it.each([{ available: false }, { fail: true }])(
    "retains host refs and cache when native removal is unconfirmed: %j",
    async (options) => {
      const f = fixture(options);

      await f.remove.execute({
        pluginName: SELECTED_PLUGIN,
        toolIds: [claude],
        projectRoot: SELECTION_ROOT,
      });

      expect(f.record.getNativeRegistrations(claude)?.pluginRefs).toEqual([FOREIGN, REF]);
      expect(f.fs.getFile(f.cache)).toBe("target cache");
      expect(f.fs.getFile(f.foreignCache)).toBe("foreign cache");
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.logger.warnMessages).toContain(
        `claude: cache for '${SELECTED_PLUGIN}' left in place, its own removal was not confirmed: ${join(homedir(), ".claude", "plugins", "cache", HOST, SELECTED_PLUGIN)}`
      );
      expect(f.logger.infoMessages).toEqual([]);
      expect(f.record.getPlugins(claude).map((entry) => entry.name)).toEqual(["other-plugin"]);
    }
  );

  it("names the local alias when an unavailable host has no recorded catalogue", async () => {
    const f = fixture({ available: false, registrations: false });

    await f.remove.execute({
      pluginName: SELECTED_PLUGIN,
      toolIds: [claude],
      projectRoot: SELECTION_ROOT,
    });

    expect(f.activator.uninstalledPlugins).toEqual([]);
    expect(f.record.getNativeRegistrations(claude)).toBeUndefined();
    expect(f.fs.getFile(f.cache)).toBe("target cache");
    expect(f.logger.warnMessages).toEqual([
      `claude CLI not found on PATH — '${SELECTED_PLUGIN}@${ALIAS}' was not uninstalled from the host; its ref may remain enabled after local removal.`,
    ]);
    expect(f.repo.saveCount).toBe(1);
  });

  it("detaches only this project's exact machine-owned native claim without disabling the shared ref", async () => {
    const project = aManifest()
      .withTool(codex, [])
      .withTool(cursor, [])
      .withPlugin(codex, anInstalledPlugin({ scope: "project", marketplace: ALIAS }))
      .build();
    const provenance = {
      kind: "effective-list" as const,
      root: "/host/root",
      sourceType: "local",
      source: "/plugin-source",
    };
    const registrations = {
      binary: "codex",
      marketplaces: [{ alias: ALIAS, hostName: HOST, provenance }],
      pluginRefs: [FOREIGN, REF],
      pluginClaims: [
        { ref: FOREIGN, dependents: [SELECTION_ROOT, SELECTION_OTHER_ROOT] },
        { ref: REF, dependents: [SELECTION_ROOT, SELECTION_OTHER_ROOT] },
      ],
    };
    project.setNativeRegistrations(codex, registrations);
    const machine = Manifest.create();
    machine.addTool(codex, "1.0.0", []);
    machine.setNativeRegistrations(codex, registrations);
    const userRepo = new InMemoryManifestRepository(machine);
    const projectRepo = new InMemoryManifestRepository(project, SELECTION_ROOT);
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();
    const remove = pluginRemover({
      fs: new InMemoryFileAdapter({}, [SELECTION_ROOT, SELECTION_OTHER_ROOT]),
      manifestRepo: projectRepo,
      logger,
      activators: new Map([[codex, activator]]),
      userManifestRepo: userRepo,
      nativeMarketplaceSources: new Map([
        [
          codex,
          {
            read: async () => ({
              location: "/host/catalogues",
              entries: new Map([[HOST, provenance]]),
            }),
          },
        ],
      ]),
    });

    await remove.execute({
      pluginName: SELECTED_PLUGIN,
      toolIds: "all",
      projectRoot: SELECTION_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(machine.getNativeRegistrations(codex)?.pluginRefs).toEqual([FOREIGN, REF]);
    expect(machine.getNativeRegistrations(codex)?.pluginClaims).toEqual([
      { ref: FOREIGN, dependents: [SELECTION_ROOT, SELECTION_OTHER_ROOT] },
      { ref: REF, dependents: [SELECTION_OTHER_ROOT] },
    ]);
    expect(project.getNativeRegistrations(codex)?.pluginRefs).toEqual([FOREIGN]);
    expect(project.getPlugins(codex)).toEqual([]);
    expect(project.getPlugins(cursor)).toEqual([]);
    expect(userRepo.saveCount).toBe(1);
    expect(projectRepo.saveCount).toBe(1);
    expect(logger.warnMessages).toEqual([
      `codex: '${REF}' is an AIDD-owned machine plugin ref — left enabled; this project's claim detaches after local removal.`,
    ]);
  });
});
