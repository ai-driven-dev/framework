import { describe, expect, it } from "vitest";
import { PurgeUserScopeMachine } from "../../../../../src/contexts/installation/application/clean/purge-user-scope-machine.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";
import { userScopeParts } from "../../testing/user-scope-purge.builder.js";

const ROOT = "/project";

function fixture(options: Parameters<typeof userScopeParts>[0] = {}) {
  const parts = userScopeParts(options);
  const { userManifestRepo, purgeMachineState, homeDir, userScopePluginFiles } = parts.deps;
  return {
    ...parts,
    purger: new PurgeUserScopeMachine(
      { userManifestRepo, purgeMachineState, homeDir, userScopePluginFiles },
      parts.tools
    ),
  };
}

describe("purging the user-scope machine state", () => {
  it("removes the proven plugin files and purges the machine state, keeping the manifest", async () => {
    const { repo, files, machine, purger: purge } = fixture();

    await purge.purge(ROOT);

    expect(files.removed.map((removed) => [...removed.keys()])).toEqual([["a.md", "b.md"]]);
    expect(machine.purgeCount).toBe(1);
    expect(repo.getCurrent()).not.toBeNull();
  });

  it("leaves a project-scope plugin's files alone", async () => {
    const projectPlugin = RecordedPlugin.fromJSON({
      name: "kept",
      source: { kind: "local", path: "/fixture" },
      version: "1.0.0",
      strict: false,
      files: { "k.md": "h" },
      scope: "project",
      dependents: [],
    });
    const manifest = aManifest()
      .withTool(TOOL.claude, [])
      .withPlugin(TOOL.claude, projectPlugin)
      .build();
    const { files, purger: purge } = fixture({ manifest });

    await purge.purge(ROOT);

    expect(files.removed).toEqual([]);
  });

  it("still purges the machine state and deletes nothing it has no manifest for", async () => {
    const { files, machine, purger: purge } = fixture({ manifest: null });

    await purge.purge(ROOT);

    expect(files.removed).toEqual([]);
    expect(machine.purgeCount).toBe(1);
  });
});
