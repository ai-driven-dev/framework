import { describe, expect, it } from "vitest";
import { assertExistingContributionsUnchanged } from "../../../../../../src/contexts/installation/application/plugin/add/assert-existing-contributions.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

function manifestWith(plugin: RecordedPlugin): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.cursor, "1.0.0", []);
  manifest.addPlugin(TOOL.cursor, plugin);
  return manifest;
}

const BASE = {
  name: "sample",
  version: "1.0.0",
  source: { kind: "local" as const, path: "/plugin" },
  strict: false,
  scope: "project" as const,
};

describe("assertExistingContributionsUnchanged", () => {
  it("accepts a plugin that contributed nothing to the project", async () => {
    const manifest = manifestWith(RecordedPlugin.fromMetadata(BASE));

    await expect(
      assertExistingContributionsUnchanged(
        new InMemoryFileAdapter({}, ["/test-project"]),
        registeredTools(),
        {
          pluginName: "sample",
          toolIds: [TOOL.cursor],
          manifest,
          projectRoot: "/test-project",
        }
      )
    ).resolves.toBeUndefined();
  });

  it("skips a tool that does not hold the plugin", async () => {
    const manifest = manifestWith(RecordedPlugin.fromMetadata(BASE));

    await expect(
      assertExistingContributionsUnchanged(
        new InMemoryFileAdapter({}, ["/test-project"]),
        registeredTools(),
        {
          pluginName: "absent",
          toolIds: [TOOL.cursor],
          manifest,
          projectRoot: "/test-project",
        }
      )
    ).resolves.toBeUndefined();
  });

  it("refuses a hook entry recorded without a digest, which proves nothing", async () => {
    const plugin = RecordedPlugin.fromJSON({
      ...RecordedPlugin.fromMetadata(BASE).toJSON(),
      projectHooks: {
        entries: [{ event: "preToolUse", command: "node ./x.js", digest: "not-a-digest" }],
        scripts: {},
      },
    });
    const fs = new InMemoryFileAdapter({
      "/test-project/.cursor/hooks.json": JSON.stringify({ hooks: {} }),
    });

    await expect(
      assertExistingContributionsUnchanged(fs, registeredTools(), {
        pluginName: "sample",
        toolIds: [TOOL.cursor],
        manifest: manifestWith(plugin),
        projectRoot: "/test-project",
      })
    ).rejects.toThrow(/unproven install digest/);
  });
});
