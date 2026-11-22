import { describe, expect, it } from "vitest";
import type { PlacePluginRequest } from "../../../../../src/contexts/installation/application/plugin/add/place-plugin.use-case.js";
import type { AddPluginRequest } from "../../../../../src/contexts/installation/application/plugin/add/plugin-add.js";
import { AddPluginToProject } from "../../../../../src/contexts/installation/application/plugin/add-plugin-to-project.use-case.js";
import {
  DuplicatePluginError,
  MissingPluginMetadataError,
} from "../../../../../src/contexts/installation/domain/installation.error.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { VersionMismatchError } from "../../../../../src/shared/domain/shared.error.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = "/test-project";
const SOURCE = { kind: "local" as const, path: "/plugin" };

const DISTRIBUTION = new PluginDistribution({
  manifest: { name: "sample-plugin", version: "1.0.0" },
  format: TOOL.claude,
  files: [],
  components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
});

function manifestWithClaude(): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  return manifest;
}

function addToProject() {
  const placed: PlacePluginRequest[] = [];
  const addition = new AddPluginToProject(
    {
      fs: new InMemoryFileAdapter(),
      source: {
        execute: async () => ({ isGithubMarketplace: false, distribution: DISTRIBUTION }),
      },
      place: {
        execute: async (command) => {
          placed.push(command);
          for (const toolId of command.toolIds) {
            command.manifest.addPlugin(
              toolId,
              RecordedPlugin.fromMetadata({
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
    },
    registeredTools()
  );
  const manifest = manifestWithClaude();
  const targets = { toolIds: [TOOL.claude], manifest, machine: Manifest.create() };
  return { addition, targets, placed };
}

const ADD: AddPluginRequest = {
  source: SOURCE,
  toolIds: [TOOL.claude],
  projectRoot: PROJECT_ROOT,
  interactive: false,
  githubMarketplace: false,
};

describe("AddPluginToProject when a plugin is added", () => {
  it("places the plugin it reads for the named tools", async () => {
    const { addition, targets, placed } = addToProject();

    await addition.execute(ADD, targets);

    expect(placed.map((p) => [p.dist, p.toolIds])).toStrictEqual([[DISTRIBUTION, [TOOL.claude]]]);
  });

  it("refuses a plugin the tool already holds, placing nothing more", async () => {
    const { addition, targets, placed } = addToProject();
    await addition.execute(ADD, targets);

    await expect(addition.execute(ADD, targets)).rejects.toThrow(DuplicatePluginError);
    expect(placed).toHaveLength(1);
  });

  it("replaces a plugin the tool already holds when asked", async () => {
    const { addition, targets, placed } = addToProject();
    await addition.execute(ADD, targets);

    await addition.execute({ ...ADD, replace: true }, targets);

    expect(placed).toHaveLength(2);
  });

  it("refuses a plugin whose version is not the one required", async () => {
    const { addition, targets, placed } = addToProject();

    await expect(addition.execute({ ...ADD, requiredVersion: "2.0.0" }, targets)).rejects.toThrow(
      VersionMismatchError
    );
    expect(placed).toHaveLength(0);
  });

  it("refuses a github marketplace add that carries no plugin metadata", async () => {
    const { addition, targets } = addToProject();

    await expect(addition.execute({ ...ADD, githubMarketplace: true }, targets)).rejects.toThrow(
      MissingPluginMetadataError
    );
  });
});
