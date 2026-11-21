import { describe, expect, it } from "vitest";
import type { PlacePluginCommand } from "../../../../../src/contexts/installation/application/plugin/add/place-plugin.js";
import {
  AddPlugin,
  type PluginAddOptions,
} from "../../../../../src/contexts/installation/application/plugin/add-plugin.js";
import {
  DuplicatePluginError,
  MissingPluginMetadataError,
} from "../../../../../src/contexts/installation/domain/installation.error.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { VersionMismatchError } from "../../../../../src/shared/domain/shared.error.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = "/test-project";
const SOURCE = { kind: "local" as const, path: "/plugin" };

const DISTRIBUTION = new PluginDistribution({
  manifest: { name: "sample-plugin", version: "1.0.0" },
  format: TOOL.claude,
  files: [],
  components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
});

function addTo(manifest: Manifest) {
  const project = new InMemoryManifestRepository(manifest);
  const user = new InMemoryManifestRepository(Manifest.create());
  const placed: PlacePluginCommand[] = [];
  const fs = new InMemoryFileAdapter();
  fs.setFile(`${PROJECT_ROOT}/.aidd/manifest.json`, "{}");
  const add = new AddPlugin(
    fs,
    { project, user },
    { execute: async () => ({ isGithubMarketplace: false, distribution: DISTRIBUTION }) },
    {
      execute: async (command) => {
        placed.push(command);
        for (const toolId of command.toolIds) {
          command.manifest.addPlugin(
            toolId,
            InstalledPlugin.fromMetadata({
              name: "sample-plugin",
              version: "1.0.0",
              source: SOURCE,
              strict: false,
              scope: "project",
            })
          );
        }
      },
    },
    registeredTools()
  );
  return { add, project, placed };
}

function manifestWithClaude(): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  return manifest;
}

const ADD: PluginAddOptions = {
  source: SOURCE,
  toolIds: [TOOL.claude],
  projectRoot: PROJECT_ROOT,
  interactive: false,
  githubMarketplace: false,
};

describe("AddPlugin", () => {
  it("places the plugin it reads for the named tools, then saves the project manifest", async () => {
    const { add, project, placed } = addTo(manifestWithClaude());

    await add.execute(ADD);

    expect([
      placed.map((p) => [p.dist, p.toolIds]),
      project.getCurrent()?.getPlugins(TOOL.claude).length,
      project.saveCount,
    ]).toStrictEqual([[[DISTRIBUTION, [TOOL.claude]]], 1, 1]);
  });

  it("refuses a plugin the tool already holds, placing nothing more", async () => {
    const { add, placed } = addTo(manifestWithClaude());
    await add.execute(ADD);

    await expect(add.execute(ADD)).rejects.toThrow(DuplicatePluginError);
    expect(placed).toHaveLength(1);
  });

  it("replaces a plugin the tool already holds when asked", async () => {
    const { add, placed } = addTo(manifestWithClaude());
    await add.execute(ADD);

    await add.execute({ ...ADD, replace: true });

    expect(placed).toHaveLength(2);
  });

  it("refuses a plugin whose version is not the one required", async () => {
    const { add, placed } = addTo(manifestWithClaude());

    await expect(add.execute({ ...ADD, requiredVersion: "2.0.0" })).rejects.toThrow(
      VersionMismatchError
    );
    expect(placed).toHaveLength(0);
  });

  it("refuses a github marketplace add that carries no plugin metadata", async () => {
    const { add } = addTo(manifestWithClaude());

    await expect(add.execute({ ...ADD, githubMarketplace: true })).rejects.toThrow(
      MissingPluginMetadataError
    );
  });
});
