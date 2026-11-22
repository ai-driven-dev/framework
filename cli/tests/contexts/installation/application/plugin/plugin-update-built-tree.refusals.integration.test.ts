import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PluginMaterializer } from "../../../../../src/contexts/installation/application/plugin/plugin-materializer.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { loadDistributionOf } from "../../../../shared/testing/load-distribution.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { fakeBuiltDeps } from "../../testing/fake-build-sources.fake.js";
import {
  attachFutureSupportedNativeClaim,
  HOME,
  insideUserScope,
  installStalePlugin,
  makeRegistry,
  makeUpdateUseCase,
  outsideUserScope,
  PROJECT_ROOT,
  USER_PLUGINS_DIR,
} from "../../testing/update-built-tree-scenario.builder.js";
import { userScopeFileGuard } from "../../testing/user-scope-file-guard.fake.js";

const { cursor, copilot } = TOOL;

describe("UpdatePlugin - built-tree materialization", () => {
  it("refuses an escaped old user file before writing a fetched build or changing its claim", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const foreign = "/foreign/sample-plugin";
    const dir = join(USER_PLUGINS_DIR, "sample-plugin");
    deps.fs.setSymlink(dir, foreign);
    deps.fs.setFile(join(foreign, "skills/demo/SKILL.md"), "foreign bytes");
    await expect(
      makeUpdateUseCase(deps, registry).execute({
        toolIds: [cursor],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).rejects.toThrow(/unsafe recorded files/);
    expect(deps.fs.getFile(join(foreign, "skills/demo/SKILL.md"))).toBe("foreign bytes");
    expect(deps.userManifestRepo.getCurrent()?.getRecordedPlugins(cursor)[0]?.plugin.version).toBe(
      "0.0.1"
    );
  });

  it("refuses to overwrite a user-edited Cursor plugin file and retains its installed digest", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const path = join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md");
    const before = deps.userManifestRepo.getCurrent()?.getRecordedPlugins(cursor)[0];
    if (before === undefined) throw new Error("fixture missing plugin claim");
    deps.fs.setFile(path, "# User edited skill\n");
    const savesBefore = deps.userManifestRepo.saveCount;
    await expect(
      makeUpdateUseCase(deps, registry).execute({
        toolIds: [cursor],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).rejects.toThrow(/edited.*SKILL.md|SKILL.md.*edited/);
    expect(deps.fs.getFile(path)).toBe("# User edited skill\n");
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
    expect(deps.userManifestRepo.getCurrent()?.getRecordedPlugins(cursor)[0].plugin.files).toEqual(
      before.plugin.files
    );
  });

  it("refuses a new built file that the user created after v1 without changing bytes or claims", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const newRelativePath = "sample-plugin/skills/demo/new.md";
    const destination = join(USER_PLUGINS_DIR, newRelativePath);
    const machineBefore = deps.userManifestRepo.getCurrent()?.getRecordedPlugins(cursor)[0];
    if (machineBefore === undefined) throw new Error("fixture missing plugin claim");
    const savesBefore = deps.userManifestRepo.saveCount;
    deps.fs.setFile(join("/built/cursor/plugins", newRelativePath), "# Built v2\n");
    deps.fs.setFile(destination, "# User-created\n");

    await expect(
      makeUpdateUseCase(deps, registry).execute({
        toolIds: [cursor],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).rejects.toThrow(/new.md.*untracked|untracked.*new.md/);

    expect(deps.fs.getFile(destination)).toBe("# User-created\n");
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
    expect(deps.userManifestRepo.getCurrent()?.getRecordedPlugins(cursor)[0]).toEqual(
      machineBefore
    );
  });

  it("refuses an untracked identical file without changing its bytes or claiming it", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const newRelativePath = "sample-plugin/skills/demo/new.md";
    deps.fs.setFile(join("/built/cursor/plugins", newRelativePath), "# Built v2\n");
    deps.fs.setFile(join(USER_PLUGINS_DIR, newRelativePath), "# Built v2\n");

    const before = deps.userManifestRepo.getCurrent()?.getRecordedPlugins(cursor)[0];
    const savesBefore = deps.userManifestRepo.saveCount;
    await expect(
      makeUpdateUseCase(deps, registry).execute({
        toolIds: [cursor],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).rejects.toThrow(/new.md.*untracked|untracked.*new.md/);

    expect(deps.fs.getFile(join(USER_PLUGINS_DIR, newRelativePath))).toBe("# Built v2\n");
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
    expect(deps.userManifestRepo.getCurrent()?.getRecordedPlugins(cursor)[0]).toEqual(before);
  });

  it("preflights a Cursor user-file collision before any selected native host update", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const { machine, activator, nativeHost } = attachFutureSupportedNativeClaim(deps);
    const newRelativePath = "sample-plugin/skills/demo/new.md";
    const destination = join(USER_PLUGINS_DIR, newRelativePath);
    deps.fs.setFile(join("/built/cursor/plugins", newRelativePath), "# Built v2\n");
    deps.fs.setFile(destination, "# User-created\n");
    const claimBefore = machine.getNativeRegistrations(copilot)?.pluginClaims;
    const savesBefore = deps.userManifestRepo.saveCount;

    await expect(
      makeUpdateUseCase(deps, registry, nativeHost).execute({
        toolIds: [copilot, cursor],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).rejects.toThrow(/new.md.*untracked|untracked.*new.md/);

    expect(activator.updatedPlugins).toEqual([]);
    expect(deps.fs.getFile(destination)).toBe("# User-created\n");
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
    expect(machine.getNativeRegistrations(copilot)?.pluginClaims).toEqual(claimBefore);
  });

  it("refuses a tracked old path redirected outside the user boundary between plan and apply", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const machine = deps.userManifestRepo.getCurrent();
    const stale = machine
      ?.getRecordedPlugins(cursor)
      .find((plugin) => plugin.plugin.name === "sample-plugin");
    if (machine === null || stale === undefined) throw new Error("fixture missing plugin");
    const oldRelativePath = "sample-plugin/skills/obsolete/SKILL.md";
    deps.fs.setFile(join(USER_PLUGINS_DIR, oldRelativePath), "old owned bytes");
    machine.updatePlugin(
      cursor,
      stale.withFiles(
        new Map([...stale.plugin.files, [oldRelativePath, FileHash.of("old owned bytes").value]])
      )
    );
    const updater = new PluginMaterializer({
      fs: deps.fs,
      loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
      guard: userScopeFileGuard,
      builtDeps: fakeBuiltDeps(deps.fs, { marketplaceRegistry: registry, homedir: () => HOME }),
    });
    const plan = await updater.planUpdate({
      plugin: machine.getRecordedPlugins(cursor)[0],
      tool: registeredTools().aiProfile(cursor),
      projectRoot: PROJECT_ROOT,
      logger: deps.logger,
      rebuild: false,
      isWithinUserScope: insideUserScope,
    });
    if (plan === null) throw new Error("fixture did not plan a newer build");
    const foreign = "/foreign/obsolete";
    deps.fs.setSymlink(join(USER_PLUGINS_DIR, "sample-plugin/skills/obsolete"), foreign);
    deps.fs.setFile(join(foreign, "SKILL.md"), "outside user bytes");
    const writeSpy = vi.spyOn(deps.fs, "writeFile");

    await expect(
      updater.applyUpdate(plan, { logger: deps.logger, isWithinUserScope: outsideUserScope })
    ).rejects.toThrow(/unsafe recorded files/);

    expect(writeSpy).not.toHaveBeenCalled();
    expect(deps.fs.getFile(join(foreign, "SKILL.md"))).toBe("outside user bytes");
    expect(machine.getRecordedPlugins(cursor)[0]?.plugin.version).toBe("0.0.1");
  });

  it("reports manual reconciliation when user-file I/O fails after an irreversible native update", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const { machine, activator, nativeHost } = attachFutureSupportedNativeClaim(deps);
    const newRelativePath = "sample-plugin/skills/demo/new.md";
    const destination = join(USER_PLUGINS_DIR, newRelativePath);
    deps.fs.setFile(join("/built/cursor/plugins", newRelativePath), "# Built v2\n");
    const writeFile = deps.fs.writeFile.bind(deps.fs);
    const writeFailure = new Error("EACCES: injected destination write failure");
    vi.spyOn(deps.fs, "writeFile").mockImplementation(async (path, content) => {
      if (path === destination) throw writeFailure;
      return writeFile(path, content);
    });
    const savesBefore = deps.userManifestRepo.saveCount;

    const operation = makeUpdateUseCase(deps, registry, nativeHost).execute({
      toolIds: [copilot, cursor],
      projectRoot: PROJECT_ROOT,
      scope: "user",
    });
    await expect(operation).rejects.toThrow(
      /native ref may already have been updated.*reconcile manually/
    );
    await expect(operation).rejects.toMatchObject({ cause: writeFailure });

    expect(activator.updatedPlugins).toEqual(["native-plugin@aidd-catalog"]);
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
    expect(machine.getRecordedPlugins(cursor)[0]?.plugin.version).toBe("0.0.1");
    expect(machine.getNativeRegistrations(copilot)?.pluginClaims).toEqual([
      { ref: "native-plugin@aidd-catalog", dependents: [PROJECT_ROOT] },
    ]);
  });

  it("prunes only old owned paths and keeps dependent roots when replacing the user files", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const machine = deps.userManifestRepo.getCurrent();
    const stale = machine
      ?.getRecordedPlugins(cursor)
      .find((plugin) => plugin.plugin.name === "sample-plugin");
    if (machine === null || stale === undefined) throw new Error("fixture missing plugin");
    const oldPath = "sample-plugin/skills/obsolete/SKILL.md";
    const oldAbsolute = join(USER_PLUGINS_DIR, oldPath);
    deps.fs.setFile(oldAbsolute, "old owned bytes");
    machine.updatePlugin(
      cursor,
      stale
        .withFiles(
          new Map([...stale.plugin.files, [oldPath, FileHash.of("old owned bytes").value]])
        )
        .withMachineClaim([PROJECT_ROOT, "/B"])
    );
    expect(
      await makeUpdateUseCase(deps, registry).execute({
        toolIds: [cursor],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).toEqual(["sample-plugin"]);
    expect(deps.fs.getFile(oldAbsolute)).toBeUndefined();
    const owned = deps.userManifestRepo.getCurrent()?.getRecordedPlugins(cursor)[0];
    expect(owned?.machineClaim).toEqual([PROJECT_ROOT, "/B"]);
    expect(owned?.plugin.files.has(oldPath)).toBe(false);
  });
});
