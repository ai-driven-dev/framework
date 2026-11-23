import { describe, expect, it } from "vitest";
import { projectIntegrationOf } from "../../../../../../src/composition/contexts/installation.js";
import { supersedeExisting } from "../../../../../../src/contexts/installation/application/plugin/add/supersede-existing.js";
import { DuplicatePluginError } from "../../../../../../src/contexts/installation/domain/installation.error.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

function installedManifest(): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  manifest.addPlugin(
    TOOL.claude,
    RecordedPlugin.fromMetadata({
      name: "sample",
      version: "1.0.0",
      source: { kind: "local", path: "/plugin" },
      strict: false,
      scope: "project",
    }).withMcpEntries(new Map([["server", "digest"]]))
  );
  return manifest;
}

const REQUEST = { pluginName: "sample", toolIds: [TOOL.claude], projectRoot: "/test-project" };

describe("when a plugin is already installed", () => {
  it("drops the earlier install on replace and returns what it left behind", async () => {
    const manifest = installedManifest();

    const previous = await supersedeExisting(
      projectIntegrationOf(new InMemoryFileAdapter()).assertIntegration,
      registeredTools(),
      {
        ...REQUEST,
        manifest,
        replace: true,
      }
    );

    expect(manifest.getPlugins(TOOL.claude)).toStrictEqual([]);
    expect(previous.mcpEntries.get(TOOL.claude)?.get("server")).toBe("digest");
  });

  it("refuses a duplicate when it does not replace", async () => {
    const manifest = installedManifest();

    await expect(
      supersedeExisting(
        projectIntegrationOf(new InMemoryFileAdapter()).assertIntegration,
        registeredTools(),
        { ...REQUEST, manifest }
      )
    ).rejects.toThrow(DuplicatePluginError);
    expect(manifest.getPlugins(TOOL.claude)).toHaveLength(1);
  });
});
