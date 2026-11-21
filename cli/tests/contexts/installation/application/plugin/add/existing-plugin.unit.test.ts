import { describe, expect, it } from "vitest";
import {
  assertNoDuplicates,
  assertRequestedVersion,
  dropExistingPlugin,
  previousInstall,
} from "../../../../../../src/contexts/installation/application/plugin/add/existing-plugin.js";
import { DuplicatePluginError } from "../../../../../../src/contexts/installation/domain/installation.error.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { PluginDistribution } from "../../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { VersionMismatchError } from "../../../../../../src/shared/domain/shared.error.js";
import { TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

const SOURCE = { kind: "local" as const, path: "/plugin" };

function plugin(name: string): InstalledPlugin {
  return InstalledPlugin.fromMetadata({
    name,
    version: "1.0.0",
    source: SOURCE,
    strict: false,
    scope: "project",
  });
}

function manifestWith(...plugins: InstalledPlugin[]): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  for (const p of plugins) manifest.addPlugin(TOOL.claude, p);
  return manifest;
}

describe("previousInstall", () => {
  it("collects the recorded MCP entries and project hooks of the named plugin only", () => {
    const withMcp = InstalledPlugin.withMcpEntries(
      plugin("sample"),
      new Map([["server", "digest"]])
    );
    const manifest = manifestWith(withMcp, plugin("other"));

    const previous = previousInstall("sample", [TOOL.claude], manifest);

    expect([...previous.mcpEntries]).toStrictEqual([[TOOL.claude, withMcp.mcpEntries]]);
    expect(previous.projectHooks.size).toBe(0);
  });

  it("records nothing for a plugin that was not installed", () => {
    const previous = previousInstall("sample", [TOOL.claude], manifestWith());

    expect(previous.mcpEntries.size).toBe(0);
  });
});

describe("assertNoDuplicates", () => {
  it("refuses a plugin already installed for a target tool", () => {
    expect(() =>
      assertNoDuplicates("sample", [TOOL.claude], manifestWith(plugin("sample")))
    ).toThrow(DuplicatePluginError);
  });

  it("accepts a plugin that is not installed yet", () => {
    expect(() => assertNoDuplicates("sample", [TOOL.claude], manifestWith())).not.toThrow();
  });
});

describe("dropExistingPlugin", () => {
  it("removes the plugin from every target tool and keeps the others", () => {
    const manifest = manifestWith(plugin("sample"), plugin("other"));

    dropExistingPlugin("sample", [TOOL.claude], manifest);

    expect(manifest.getPlugins(TOOL.claude).map((p) => p.name)).toStrictEqual(["other"]);
  });
});

describe("assertRequestedVersion", () => {
  const dist = new PluginDistribution({
    manifest: { name: "sample", version: "1.0.0" },
    format: TOOL.claude,
    files: [],
    components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
  });

  it("refuses a pinned version the source does not carry", () => {
    expect(() => assertRequestedVersion(dist, "2.0.0")).toThrow(VersionMismatchError);
  });

  it("accepts the carried version and an absent pin", () => {
    expect(() => assertRequestedVersion(dist, "1.0.0")).not.toThrow();
    expect(() => assertRequestedVersion(dist, undefined)).not.toThrow();
  });
});
