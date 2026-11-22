import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginNotFoundError } from "../../../../../src/contexts/installation/domain/installation.error.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { pluginRemover, userPluginRemover } from "../../testing/plugin-remover.builder.js";

import {
  aMachineWithClaudeAndCursor,
  anInstalledPlugin,
  SELECTED_PLUGIN,
  SELECTION_OTHER_ROOT,
  SELECTION_ROOT,
} from "../../testing/plugin-selection-scenario.builder.js";

const { claude, cursor } = TOOL;

describe("plugin removal selects the recorded owner, name and tool", () => {
  it("detaches only the selected user plugin's project claim while preserving global files", async () => {
    const project = aMachineWithClaudeAndCursor();
    const machine = aMachineWithClaudeAndCursor();
    for (const toolId of [cursor, claude]) {
      for (const name of ["other-plugin", SELECTED_PLUGIN]) {
        project.addPlugin(
          toolId,
          anInstalledPlugin({ name, files: { [`${name}/keep.md`]: "digest" } })
        );
        machine.addPlugin(
          toolId,
          anInstalledPlugin({ name, dependents: [SELECTION_ROOT, SELECTION_OTHER_ROOT] })
        );
      }
    }
    const fs = new InMemoryFileAdapter({}, [SELECTION_ROOT, SELECTION_OTHER_ROOT]);
    const witness = join(homedir(), ".cursor", "plugins", "local", SELECTED_PLUGIN, "keep.md");
    fs.setFile(witness, "machine bytes");
    const projectRepo = new InMemoryManifestRepository(project, SELECTION_ROOT);
    const userRepo = new InMemoryManifestRepository(machine);
    const remove = pluginRemover({ fs, manifestRepo: projectRepo, userManifestRepo: userRepo });

    await remove.execute({
      pluginName: SELECTED_PLUGIN,
      toolIds: [cursor],
      projectRoot: SELECTION_ROOT,
    });

    expect(project.getRecordedPlugins(cursor).map((entry) => entry.plugin.name)).toEqual([
      "other-plugin",
    ]);
    expect(project.getRecordedPlugins(claude).map((entry) => entry.plugin.name)).toEqual([
      "other-plugin",
      SELECTED_PLUGIN,
    ]);
    expect(
      machine.getRecordedPlugins(cursor).map((entry) => [entry.plugin.name, entry.dependents])
    ).toEqual([
      ["other-plugin", [SELECTION_ROOT, SELECTION_OTHER_ROOT]],
      [SELECTED_PLUGIN, [SELECTION_OTHER_ROOT]],
    ]);
    expect(machine.getRecordedPlugins(claude).map((entry) => entry.dependents)).toEqual([
      [SELECTION_ROOT, SELECTION_OTHER_ROOT],
      [SELECTION_ROOT, SELECTION_OTHER_ROOT],
    ]);
    expect(fs.getFile(witness)).toBe("machine bytes");
    expect(projectRepo.saveCount).toBe(1);
    expect(userRepo.saveCount).toBe(1);
  });

  it("removing a project entry does not detach the same name's machine claim", async () => {
    const project = aMachineWithClaudeAndCursor();
    const machine = aMachineWithClaudeAndCursor();
    project.addPlugin(
      cursor,
      anInstalledPlugin({ scope: "project", files: { "owned.md": "digest" } })
    );
    project.addPlugin(cursor, anInstalledPlugin({ name: "other-plugin", scope: "user" }));
    machine.addPlugin(
      cursor,
      anInstalledPlugin({ dependents: [SELECTION_ROOT, SELECTION_OTHER_ROOT] })
    );
    machine.addPlugin(
      cursor,
      anInstalledPlugin({
        name: "other-plugin",
        dependents: [SELECTION_ROOT, SELECTION_OTHER_ROOT],
      })
    );
    const before = machine.toJSON();
    const fs = new InMemoryFileAdapter(
      {
        [join(SELECTION_ROOT, "owned.md")]: "owned",
        [join(SELECTION_ROOT, "foreign.md")]: "foreign",
      },
      [SELECTION_ROOT, SELECTION_OTHER_ROOT]
    );
    const userRepo = new InMemoryManifestRepository(machine);
    const remove = pluginRemover({
      fs,
      manifestRepo: new InMemoryManifestRepository(project, SELECTION_ROOT),
      userManifestRepo: userRepo,
    });

    await remove.execute({
      pluginName: SELECTED_PLUGIN,
      toolIds: [cursor],
      projectRoot: SELECTION_ROOT,
    });

    expect(await fs.fileExists(join(SELECTION_ROOT, "owned.md"))).toBe(false);
    expect(fs.getFile(join(SELECTION_ROOT, "foreign.md"))).toBe("foreign");
    expect(machine.toJSON()).toEqual(before);
    expect(userRepo.saveCount).toBe(0);
    expect(project.getRecordedPlugins(cursor).map((entry) => entry.plugin.name)).toEqual([
      "other-plugin",
    ]);
  });

  it("user removal skips a project-scoped copy and other names with active dependents", async () => {
    const machine = aMachineWithClaudeAndCursor();
    machine.addPlugin(
      cursor,
      anInstalledPlugin({ name: "other-plugin", dependents: [SELECTION_OTHER_ROOT] })
    );
    machine.addPlugin(cursor, anInstalledPlugin());
    machine.addPlugin(
      claude,
      anInstalledPlugin({ scope: "project", dependents: [SELECTION_OTHER_ROOT] })
    );
    const otherBefore = machine.getRecordedPlugins(cursor)[0].toJSON();
    const claudeBefore = machine.getRecordedPlugins(claude)[0].toJSON();
    const userRepo = new InMemoryManifestRepository(machine);
    const remove = userPluginRemover({ userManifestRepo: userRepo });

    await remove.execute({
      pluginName: SELECTED_PLUGIN,
      toolIds: "all",
      projectRoot: SELECTION_ROOT,
    });

    expect(machine.getRecordedPlugins(cursor).map((entry) => entry.toJSON())).toEqual([
      otherBefore,
    ]);
    expect(machine.getRecordedPlugins(claude).map((entry) => entry.toJSON())).toEqual([
      claudeBefore,
    ]);
    expect(userRepo.saveCount).toBe(1);
  });

  it("user removal reports a project-only match as absent without saving either manifest", async () => {
    const machine = aMachineWithClaudeAndCursor();
    machine.addPlugin(cursor, anInstalledPlugin({ scope: "project" }));
    const before = machine.toJSON();
    const userRepo = new InMemoryManifestRepository(machine);
    const remove = userPluginRemover({ userManifestRepo: userRepo });

    await expect(
      remove.execute({
        pluginName: SELECTED_PLUGIN,
        toolIds: [cursor],
        projectRoot: SELECTION_ROOT,
      })
    ).rejects.toThrow(PluginNotFoundError);

    expect(machine.toJSON()).toEqual(before);
    expect(userRepo.saveCount).toBe(0);
  });

  it("explicit user removal deletes the proven global file without touching the project copy", async () => {
    const relative = `${SELECTED_PLUGIN}/commands/owned.md`;
    const content = "installed machine bytes";
    const machine = aMachineWithClaudeAndCursor();
    machine.addPlugin(
      cursor,
      anInstalledPlugin({ files: { [relative]: FileHash.of(content).value } })
    );
    const fs = new InMemoryFileAdapter({}, [SELECTION_ROOT, SELECTION_OTHER_ROOT]);
    const userPath = join(homedir(), ".cursor", "plugins", "local", relative);
    const projectPath = join(SELECTION_ROOT, relative);
    fs.setFile(userPath, content);
    fs.setFile(projectPath, "project bytes");
    const userRepo = new InMemoryManifestRepository(machine);
    const remove = userPluginRemover({
      fs,
      userManifestRepo: userRepo,
    });

    await remove.execute({
      pluginName: SELECTED_PLUGIN,
      toolIds: [cursor],
      projectRoot: SELECTION_ROOT,
    });

    expect(await fs.fileExists(userPath)).toBe(false);
    expect(fs.getFile(projectPath)).toBe("project bytes");
    expect(machine.getRecordedPlugins(cursor)).toEqual([]);
    expect(userRepo.saveCount).toBe(1);
  });

  it("refuses a partial user removal before deleting safe files when another tracked path escapes", async () => {
    const content = "installed bytes";
    const hash = FileHash.of(content).value;
    const relative = `${SELECTED_PLUGIN}/owned.md`;
    const machine = aMachineWithClaudeAndCursor();
    machine.addPlugin(
      cursor,
      anInstalledPlugin({ files: { [relative]: hash, "../outside.md": hash } })
    );
    const before = machine.toJSON();
    const base = join(homedir(), ".cursor", "plugins", "local");
    const fs = new InMemoryFileAdapter(
      {
        [join(base, relative)]: content,
        [join(base, "../outside.md")]: content,
      },
      [SELECTION_ROOT, SELECTION_OTHER_ROOT]
    );
    const userRepo = new InMemoryManifestRepository(machine);
    const remove = userPluginRemover({
      fs,
      userManifestRepo: userRepo,
    });

    await expect(
      remove.execute({
        pluginName: SELECTED_PLUGIN,
        toolIds: [cursor],
        projectRoot: SELECTION_ROOT,
      })
    ).rejects.toThrow(
      `Refusing partial removal of user-scope plugin '${SELECTED_PLUGIN}': a tracked file escaped its boundary.`
    );

    expect(fs.getFile(join(base, relative))).toBe(content);
    expect(fs.getFile(join(base, "../outside.md"))).toBe(content);
    expect(machine.toJSON()).toEqual(before);
    expect(userRepo.saveCount).toBe(0);
  });

  it("refuses unproven project hooks before deleting any tracked plugin file", async () => {
    const project = aMachineWithClaudeAndCursor();
    project.addPlugin(
      cursor,
      anInstalledPlugin({ scope: "project", files: { "owned.md": "digest" } })
    );
    const before = project.toJSON();
    const script = join(SELECTION_ROOT, ".cursor", "hooks", SELECTED_PLUGIN, "edited.sh");
    const file = join(SELECTION_ROOT, "owned.md");
    const fs = new InMemoryFileAdapter(
      {
        [script]: "unproven hook bytes",
        [file]: "installed plugin bytes",
      },
      [SELECTION_ROOT, SELECTION_OTHER_ROOT]
    );
    const repo = new InMemoryManifestRepository(project, SELECTION_ROOT);
    const remove = pluginRemover({ fs, manifestRepo: repo });

    await expect(
      remove.execute({
        pluginName: SELECTED_PLUGIN,
        toolIds: [cursor],
        projectRoot: SELECTION_ROOT,
      })
    ).rejects.toThrow(/unproven legacy install digest/);

    expect(fs.getFile(file)).toBe("installed plugin bytes");
    expect(fs.getFile(script)).toBe("unproven hook bytes");
    expect(project.toJSON()).toEqual(before);
    expect(repo.saveCount).toBe(0);
  });

  it("preserves a scope-aware host ref when no activator confirmed its removal", async () => {
    const project = aMachineWithClaudeAndCursor();
    project.addPlugin(claude, anInstalledPlugin({ scope: "project", marketplace: "local-alias" }));
    const ref = `${SELECTED_PLUGIN}@host-catalogue`;
    const registrations = {
      binary: "claude",
      marketplaces: [{ alias: "local-alias", hostName: "host-catalogue" }],
      pluginRefs: [ref, "other-plugin@host-catalogue"],
      pluginClaims: [{ ref, dependents: [SELECTION_ROOT, SELECTION_OTHER_ROOT] }],
    };
    project.setNativeRegistrations(claude, registrations);
    const machine = aMachineWithClaudeAndCursor();
    machine.setNativeRegistrations(claude, registrations);
    const repo = new InMemoryManifestRepository(project, SELECTION_ROOT);
    const userRepo = new InMemoryManifestRepository(machine);
    const remove = pluginRemover({
      fs: new InMemoryFileAdapter({}, [SELECTION_ROOT, SELECTION_OTHER_ROOT]),
      manifestRepo: repo,
      userManifestRepo: userRepo,
    });

    await remove.execute({
      pluginName: SELECTED_PLUGIN,
      toolIds: [claude],
      projectRoot: SELECTION_ROOT,
    });

    expect(project.getNativeRegistrations(claude)?.pluginRefs).toEqual([
      ref,
      "other-plugin@host-catalogue",
    ]);
    expect(machine.getNativeRegistrations(claude)?.pluginRefs).toEqual([
      ref,
      "other-plugin@host-catalogue",
    ]);
    expect(machine.getNativeRegistrations(claude)?.pluginClaims).toEqual([
      { ref, dependents: [SELECTION_OTHER_ROOT] },
    ]);
    expect(project.getRecordedPlugins(claude)).toEqual([]);
    expect(userRepo.saveCount).toBe(1);
    expect(repo.saveCount).toBe(1);
  });
});
