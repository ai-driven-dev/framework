import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { BuiltMarketplaceEnsurer } from "../../../../../src/contexts/installation/contract/built-marketplace.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import {
  claimsRecorded,
  dependentsRecorded,
} from "../../../../shared/testing/host-record-reading.builder.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";
import { holdPlugin } from "../../testing/plugin-selection-scenario.builder.js";
import {
  attachFutureSupportedNativeClaim,
  BUILT_SKILL,
  installStalePlugin,
  makeRegistry,
  makeUpdateUseCase,
  PLUGIN_FIXTURE,
  PROJECT_ROOT,
  USER_PLUGINS_DIR,
} from "../../testing/update-built-tree-scenario.builder.js";

const { cursor, copilot } = TOOL;
const recordedNamed = (manifest: Manifest | null | undefined, name: string) =>
  manifest?.getRecordedPlugins(cursor).find((recorded) => recorded.plugin.name === name);

describe("UpdatePlugin - built-tree materialization", () => {
  it("refuses an absent machine manifest before touching user files", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    const registry = await makeRegistry();
    await deps.userManifestRepo.delete();
    const path = join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md");
    deps.fs.setFile(path, "user bytes");
    const savesBefore = deps.userManifestRepo.saveCount;

    await expect(
      makeUpdateUseCase(deps, registry).execute({
        toolIds: [cursor],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).rejects.toThrow(/No machine manifest.*ownership/);

    expect(deps.userManifestRepo.getCurrent()).toBeNull();
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
    expect(deps.fs.getFile(path)).toBe("user bytes");
  });

  it("checks current user bytes inside the machine repository's exclusive-access boundary", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const path = join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md");
    const before = deps.userManifestRepo.getCurrent()?.toJSON();
    const savesBefore = deps.userManifestRepo.saveCount;
    let acquired = false;
    Object.assign(deps.userManifestRepo, {
      withExclusiveAccess: async (operation: () => Promise<string[]>) => {
        acquired = true;
        deps.fs.setFile(path, "user edit at lock acquisition");
        return operation();
      },
    });

    await expect(
      makeUpdateUseCase(deps, registry).execute({
        toolIds: [cursor],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).rejects.toMatchObject({ code: "edited-after-install" });

    expect(acquired).toBe(true);
    expect(deps.fs.getFile(path)).toBe("user edit at lock acquisition");
    expect(deps.userManifestRepo.getCurrent()?.toJSON()).toStrictEqual(before);
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
  });

  it.each([{ dependents: [] }, { dependents: [PROJECT_ROOT, "/B"] }])(
    "warns only for actual dependent projects when updating shared native and file plugins: $dependents",
    async ({ dependents }) => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initAndInstall(deps, PROJECT_ROOT, cursor);
      const registry = await makeRegistry();
      await installStalePlugin(deps, registry);
      const { activator, nativeHost } = attachFutureSupportedNativeClaim(deps);
      const native = deps.userManifestRepo.records.get(copilot);
      if (native === undefined) throw new Error("fixture missing selected claims");
      holdPlugin(deps.userManifestRepo.records, cursor, "sample-plugin", dependents);
      deps.userManifestRepo.records.set(copilot, {
        ...native,
        pluginClaims: [{ ref: "native-plugin@aidd-catalog", dependents }],
      });
      const warnings = vi.spyOn(deps.logger, "warn").mockImplementation(() => {});

      expect(
        await makeUpdateUseCase(deps, registry, nativeHost).execute({
          toolIds: [copilot, cursor],
          projectRoot: PROJECT_ROOT,
          scope: "user",
        })
      ).toStrictEqual(["native-plugin@aidd-catalog", "sample-plugin"]);

      expect(warnings.mock.calls).toStrictEqual(
        dependents.length === 0
          ? []
          : [
              [
                `copilot: updating native ref 'native-plugin@aidd-catalog' affects ${PROJECT_ROOT}, /B; projects must refresh their local integrations afterward.`,
              ],
              [
                `cursor: updating user-scope 'sample-plugin' affects ${PROJECT_ROOT}, /B; each project must refresh its own integration afterward.`,
              ],
            ]
      );
      expect(activator.updatedPlugins).toStrictEqual(["native-plugin@aidd-catalog"]);
      const after = deps.userManifestRepo.getCurrent();
      expect(deps.userManifestRepo.records.get(copilot)?.pluginClaims).toStrictEqual([
        { ref: "native-plugin@aidd-catalog", dependents },
      ]);
      expect(
        dependentsRecorded(deps.userManifestRepo.records.get(cursor), "sample-plugin")
      ).toStrictEqual(dependents);
      expect(
        after?.getPlugins(cursor).find((plugin) => plugin.name === "sample-plugin")?.version
      ).toBe("1.0.0");
    }
  );

  it("updates only the selected user plugin and exact native ref, preserving unrelated claims and project records", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const { machine, activator, nativeHost } = attachFutureSupportedNativeClaim(deps);
    const native = deps.userManifestRepo.records.get(copilot);
    if (native === undefined) throw new Error("fixture missing native registrations");
    const otherRef = "native-plugin@other-catalog";
    deps.userManifestRepo.records.set(copilot, {
      ...native,
      pluginClaims: [...claimsRecorded(native), { ref: otherRef, dependents: ["/B"] }],
    });
    const unselected = RecordedPlugin.fromMetadata({
      name: "unselected-plugin",
      version: "0.0.1",
      source: { kind: "local", path: "/unselected/source" },
      strict: false,
      scope: "user",
    });
    const projectOnly = RecordedPlugin.fromMetadata({
      name: "project-only",
      version: "0.0.1",
      source: { kind: "local", path: "/project/source" },
      strict: false,
      scope: "project",
    });
    machine.addPlugin(cursor, unselected);
    machine.addPlugin(cursor, projectOnly);
    holdPlugin(deps.userManifestRepo.records, cursor, "sample-plugin", [PROJECT_ROOT, "/B"]);
    const claimsBefore = deps.userManifestRepo.records.get(copilot)?.pluginClaims;
    deps.fs.setFile(BUILT_SKILL, "# Selected update");
    const otherPath = join(USER_PLUGINS_DIR, "unselected-plugin/skills/demo/SKILL.md");
    deps.fs.setFile(otherPath, "unselected user bytes");

    expect(
      await makeUpdateUseCase(deps, registry, nativeHost).execute({
        pluginNames: ["native-plugin@aidd-catalog", "sample-plugin"],
        toolIds: [copilot, cursor],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).toEqual(["native-plugin@aidd-catalog", "sample-plugin"]);

    expect(activator.updatedPlugins).toEqual(["native-plugin@aidd-catalog"]);
    const after = deps.userManifestRepo.getCurrent();
    expect(deps.userManifestRepo.records.get(copilot)?.pluginClaims).toEqual(claimsBefore);
    expect(recordedNamed(after, "unselected-plugin")).toEqual(unselected);
    expect(recordedNamed(after, "project-only")).toEqual(projectOnly);
    expect(dependentsRecorded(deps.userManifestRepo.records.get(cursor), "sample-plugin")).toEqual([
      PROJECT_ROOT,
      "/B",
    ]);
    expect(deps.fs.getFile(join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md"))).toBe(
      "# Selected update"
    );
    expect(deps.fs.getFile(otherPath)).toBe("unselected user bytes");
  });

  it("refuses one ambiguous native name among several selected plugins before any file or host update", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const { machine, activator, nativeHost } = attachFutureSupportedNativeClaim(deps);
    const native = deps.userManifestRepo.records.get(copilot);
    if (native === undefined) throw new Error("fixture missing native registrations");
    deps.userManifestRepo.records.set(copilot, {
      ...native,
      pluginClaims: [
        ...claimsRecorded(native),
        {
          ref: "native-plugin@other-catalog",
          dependents: ["/B"],
        },
      ],
    });
    const before = machine.toJSON();
    const path = join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md");
    const bytes = deps.fs.getFile(path);
    const savesBefore = deps.userManifestRepo.saveCount;
    deps.fs.setFile(BUILT_SKILL, "# Must not be delivered");

    await expect(
      makeUpdateUseCase(deps, registry, nativeHost).execute({
        pluginNames: ["sample-plugin", "native-plugin"],
        toolIds: [cursor, copilot],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).rejects.toThrow(/Multiple native catalogues.*exact/);

    expect(activator.updatedPlugins).toEqual([]);
    expect(deps.fs.getFile(path)).toBe(bytes);
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
    expect(deps.userManifestRepo.getCurrent()?.toJSON()).toEqual(before);
  });

  it("excludes built Cursor hooks from the updated user plugin and leaves both projects' hooks unchanged", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    deps.fs.setFile(BUILT_SKILL, "# Updated skill");
    const builtHooks = JSON.stringify({ hooks: { preToolUse: [{ command: "node pre.js" }] } });
    deps.fs.setFile("/built/cursor/plugins/sample-plugin/hooks/hooks.json", builtHooks);
    deps.fs.setFile("/built/cursor/plugins/sample-plugin/hooks/pre.js", "built hook script");
    const hookConfig = (timeout: number) =>
      JSON.stringify({
        version: 1,
        hooks: { preToolUse: [{ command: "node ./.cursor/hooks/sample-plugin/pre.js", timeout }] },
      });
    const projectFiles = new Map([
      [join(PROJECT_ROOT, ".cursor/hooks.json"), hookConfig(10)],
      [join(PROJECT_ROOT, ".cursor/hooks/sample-plugin/pre.js"), "A's adapted script"],
      ["/B/.cursor/hooks.json", hookConfig(20)],
      ["/B/.cursor/hooks/sample-plugin/pre.js", "B's adapted script"],
    ]);
    for (const [path, content] of projectFiles) deps.fs.setFile(path, content);

    expect(
      await makeUpdateUseCase(deps, registry).execute({
        toolIds: [cursor],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).toEqual(["sample-plugin"]);

    expect(deps.fs.getFile(join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md"))).toBe(
      "# Updated skill"
    );
    expect(
      deps.fs.getFile(join(USER_PLUGINS_DIR, "sample-plugin/hooks/hooks.json"))
    ).toBeUndefined();
    expect(deps.fs.getFile(join(USER_PLUGINS_DIR, "sample-plugin/hooks/pre.js"))).toBeUndefined();
    expect(
      [...(deps.userManifestRepo.getCurrent()?.getPlugins(cursor)[0]?.files.keys() ?? [])].some(
        (path) => path.startsWith("sample-plugin/hooks/")
      )
    ).toBe(false);
    for (const [path, content] of projectFiles) expect(deps.fs.getFile(path)).toBe(content);
  });

  it("uses the plugin's named marketplace build rather than the first registered catalogue", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = new FakeMarketplaceRegistry();
    registry.seed(PROJECT_ROOT, {
      name: "unrelated-first",
      source: { kind: "local", path: "/unrelated" },
      scope: "project",
    });
    for (const marketplace of await (await makeRegistry()).list(PROJECT_ROOT))
      registry.seed(PROJECT_ROOT, marketplace);
    await installStalePlugin(deps, registry);
    deps.fs.setFile("/built/right/plugins/sample-plugin/skills/demo/SKILL.md", "# Right catalogue");
    deps.fs.setFile("/built/wrong/plugins/sample-plugin/skills/demo/SKILL.md", "# Wrong catalogue");
    const ensureBuilt: BuiltMarketplaceEnsurer = {
      execute: async ({ marketplace }) => ({
        builtDir: marketplace.name === "aidd-framework" ? "/built/right" : "/built/wrong",
        version: "test",
        rebuilt: true,
      }),
    };

    expect(
      await makeUpdateUseCase(deps, registry, undefined, ensureBuilt).execute({
        toolIds: [cursor],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).toEqual(["sample-plugin"]);

    expect(deps.fs.getFile(join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md"))).toBe(
      "# Right catalogue"
    );
    expect(deps.userManifestRepo.getCurrent()?.getRecordedPlugins(cursor)[0]?.marketplace).toBe(
      "aidd-framework"
    );
  });

  it("re-materializes from the built tree for a marketplace plugin", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);

    deps.fs.setFile(BUILT_SKILL, "# Demo skill v2");

    const updated = await makeUpdateUseCase(deps, registry).execute({
      toolIds: [cursor],
      projectRoot: PROJECT_ROOT,
      scope: "user",
    });

    expect(updated).toContain("sample-plugin");
    const manifest = deps.userManifestRepo.getCurrent();
    const plugin = manifest?.getPlugins(cursor).find((p) => p.name === "sample-plugin");
    expect(plugin?.version).toBe("1.0.0");
    expect(plugin?.files.size).toBeGreaterThan(0);
    expect(deps.fs.getFile(join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md"))).toBe(
      "# Demo skill v2"
    );
  });

  it("writes the updated plugin under the user-scope base dir, not the project root", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);

    await makeUpdateUseCase(deps, registry).execute({
      toolIds: [cursor],
      projectRoot: PROJECT_ROOT,
      scope: "user",
    });

    const manifest = deps.userManifestRepo.getCurrent();
    const plugin = manifest?.getPlugins(cursor).find((p) => p.name === "sample-plugin");
    const written = [...(plugin?.files.keys() ?? [])];
    expect(written.length).toBeGreaterThan(0);
    for (const relativePath of written) {
      expect(deps.fs.getFile(join(USER_PLUGINS_DIR, relativePath))).toBeDefined();
      expect(deps.fs.getFile(join(PROJECT_ROOT, relativePath))).toBeUndefined();
    }
  });

  it("does not rewrite or advance a plugin already at the fetched version", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const machine = deps.userManifestRepo.getCurrent();
    const stale = machine
      ?.getRecordedPlugins(cursor)
      .find((p) => p.plugin.name === "sample-plugin");
    if (machine === null || stale === undefined) throw new Error("fixture missing plugin");
    machine.updatePlugin(cursor, stale.withPlugin(stale.plugin.withVersion("1.0.0")));
    const savesBefore = deps.userManifestRepo.saveCount;
    expect(
      await makeUpdateUseCase(deps, registry).execute({
        toolIds: [cursor],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).toEqual([]);
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
    expect(machine.getPlugins(cursor)[0]?.version).toBe("1.0.0");
  });

  it("translates a local user plugin without taking an unrelated marketplace's built tree", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, cursor);
    const registry = await makeRegistry();
    await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
    const machine = Manifest.create();
    machine.addTool(cursor, "1.0.0", []);
    machine.addPlugin(
      cursor,
      RecordedPlugin.fromMetadata({
        name: "sample-plugin",
        version: "0.0.1",
        source: { kind: "local", path: PLUGIN_FIXTURE },
        strict: false,
        scope: "user",
      })
    );
    await deps.userManifestRepo.save(machine);
    holdPlugin(deps.userManifestRepo.records, cursor, "sample-plugin", [PROJECT_ROOT]);
    expect(
      await makeUpdateUseCase(deps, registry).execute({
        toolIds: [cursor],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).toEqual(["sample-plugin"]);
    const owned = deps.userManifestRepo.getCurrent()?.getRecordedPlugins(cursor)[0];
    expect(owned?.plugin.version).toBe("1.0.0");
    expect(dependentsRecorded(deps.userManifestRepo.records.get(cursor), "sample-plugin")).toEqual([
      PROJECT_ROOT,
    ]);
    expect(owned?.plugin.files.size).toBeGreaterThan(0);
    expect(
      [...(owned?.plugin.files.keys() ?? [])].some((path) => path.includes("skills/hello"))
    ).toBe(true);
    expect([...(owned?.plugin.files.keys() ?? [])].some((path) => path.includes("hooks/"))).toBe(
      false
    );
    expect(
      deps.fs.getFile(join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md"))
    ).toBeUndefined();
  });
});
