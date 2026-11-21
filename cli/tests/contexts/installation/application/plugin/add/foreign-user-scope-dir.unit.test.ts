import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { foreignUserScopeDir } from "../../../../../../src/contexts/installation/application/plugin/add/foreign-user-scope-dir.js";
import type { PlacePluginCommand } from "../../../../../../src/contexts/installation/application/plugin/add/place-plugin.js";
import {
  resolveScopeForInstall,
  scopeBaseOf,
} from "../../../../../../src/contexts/installation/application/plugin/plugin-target-resolution.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { PluginDistribution } from "../../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

const ROOT = "/test-project";

function command(machine: Manifest): PlacePluginCommand {
  return {
    dist: new PluginDistribution({
      manifest: { name: "sample", version: "1.0.0" },
      format: TOOL.claude,
      files: [],
      components: { skills: [], commands: [], agents: [], rules: [], hooks: [], mcp: [] },
    }),
    toolIds: [],
    source: { kind: "local", path: "/plugin" },
    projectRoot: ROOT,
    manifest: Manifest.create(),
    machine,
    marketplace: undefined,
    previousMcpEntries: new Map(),
    previousProjectHooks: new Map(),
  };
}

const tools = registeredTools();
const { vscode: _ide, ...aiTools } = TOOL;
const userScoped = Object.values(aiTools)
  .map((id) => tools.aiProfile(id))
  .find((profile) => resolveScopeForInstall(profile) === "user");

describe("foreignUserScopeDir", () => {
  it("has nothing to report for a tool that installs at project scope", async () => {
    const tool = tools.aiProfile(TOOL.claude);

    expect(
      await foreignUserScopeDir(new InMemoryFileAdapter(), command(Manifest.create()), tool)
    ).toBeUndefined();
  });

  it.runIf(userScoped !== undefined)(
    "names a user directory this project did not install",
    async () => {
      const tool = userScoped ?? tools.aiProfile(TOOL.claude);
      const dir = join(scopeBaseOf(tool, { scope: "user", projectRoot: ROOT, homedir }), "sample");
      const fs = new InMemoryFileAdapter({ [join(dir, "a.md")]: "x" });

      expect(await foreignUserScopeDir(fs, command(Manifest.create()), tool)).toBe(dir);
    }
  );

  it.runIf(userScoped !== undefined)(
    "leaves a directory the machine already owns alone",
    async () => {
      const tool = userScoped ?? tools.aiProfile(TOOL.claude);
      const dir = join(scopeBaseOf(tool, { scope: "user", projectRoot: ROOT, homedir }), "sample");
      const machine = Manifest.create();
      machine.addTool(tool.toolId, "1.0.0", []);
      machine.addPlugin(
        tool.toolId,
        InstalledPlugin.fromMetadata({
          name: "sample",
          version: "1.0.0",
          source: { kind: "local", path: "/plugin" },
          strict: false,
          scope: "user",
        })
      );
      const fs = new InMemoryFileAdapter({ [join(dir, "a.md")]: "x" });

      expect(await foreignUserScopeDir(fs, command(machine), tool)).toBeUndefined();
    }
  );
});
