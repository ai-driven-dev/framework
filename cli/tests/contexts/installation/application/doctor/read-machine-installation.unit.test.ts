import { describe, expect, it } from "vitest";
import { ReadMachineInstallation } from "../../../../../src/contexts/installation/application/doctor/read-machine-installation.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { manifestRepositoryLoading } from "../../../../helpers/ports/index.js";
import { TOOL } from "../../../../shared/testing/registered-tools.js";

const pluginAt = (scope: "project" | "user") =>
  InstalledPlugin.fromJSON({
    name: "my-plugin",
    source: { kind: "github", repo: "owner/my-plugin" },
    version: "1.0.0",
    strict: false,
    files: {},
    scope,
  });

function machineWith(plugin?: InstalledPlugin): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "3.0.0", []);
  manifest.addTool(TOOL.codex, "2.0.0", []);
  if (plugin !== undefined) manifest.addPlugin(TOOL.claude, plugin);
  return manifest;
}

const readOf = (manifest: Manifest | null) =>
  new ReadMachineInstallation(manifestRepositoryLoading(async () => manifest)).execute();

describe("ReadMachineInstallation", () => {
  it("answers null when nothing is registered at user scope", async () => {
    expect(await readOf(null)).toBeNull();
  });

  it("names every installed tool and the version each was installed at", async () => {
    const view = await readOf(machineWith());

    expect(view?.toolIds).toStrictEqual([TOOL.claude, TOOL.codex]);
    expect(view?.versionOf(TOOL.claude)).toBe("3.0.0");
    expect(view?.versionOf("unknown-tool")).toBeUndefined();
  });

  it("tells whether a tool holds a user-scope plugin, and not a project one", async () => {
    const withUser = await readOf(machineWith(pluginAt("user")));
    const withProject = await readOf(machineWith(pluginAt("project")));

    expect(withUser?.hasUserPlugins(TOOL.claude)).toBe(true);
    expect(withUser?.hasUserPlugins(TOOL.codex)).toBe(false);
    expect(withProject?.hasUserPlugins(TOOL.claude)).toBe(false);
  });
});
