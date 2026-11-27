import { describe, expect, it } from "vitest";
import type { PlacePluginRequest } from "../../../../../src/contexts/installation/application/plugin/add/place-plugin.use-case.js";
import type { AddPluginRequest } from "../../../../../src/contexts/installation/application/plugin/add/plugin-add.js";
import type { ResolveAddedPluginSourceResult } from "../../../../../src/contexts/installation/application/plugin/add/resolve-added-plugin-source.use-case.js";
import { AddPluginToProject } from "../../../../../src/contexts/installation/application/plugin/add-plugin-to-project.use-case.js";
import {
  DuplicatePluginError,
  MissingPluginMetadataError,
} from "../../../../../src/contexts/installation/contract/installation.error.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import { VersionMismatchError } from "../../../../../src/shared/domain/shared.error.js";
import { fsAt } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { projectIntegrationOver } from "../../../../shared/testing/project-integration.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = "/test-project";
const SOURCE = { kind: "local" as const, path: "/plugin" };

const DISTRIBUTION = new PluginDistribution({
  manifest: { name: parsePluginName("sample-plugin"), version: "1.0.0" },
  format: TOOL.claude,
  files: [],
  components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
});

function manifestWithClaude(): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  return manifest;
}

const SAMPLE_ENTRY = {
  name: "sample-plugin",
  version: "1.0.0",
  source: SOURCE,
  strict: false,
  scope: "project" as const,
};

const LOCAL_SOURCE: ResolveAddedPluginSourceResult = {
  isGithubMarketplace: false,
  distribution: DISTRIBUTION,
};

function addToProject(resolved: ResolveAddedPluginSourceResult = LOCAL_SOURCE) {
  const placed: PlacePluginRequest[] = [];
  const addition = new AddPluginToProject(
    {
      assertIntegration: projectIntegrationOver(fsAt(PROJECT_ROOT)).assertIntegration,
      source: { execute: async () => resolved },
      place: {
        execute: async (command) => {
          placed.push(command);
          for (const toolId of command.toolIds) {
            command.manifest.addPlugin(toolId, RecordedPlugin.fromMetadata(SAMPLE_ENTRY));
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

  it("hands a github marketplace re-add the hooks and files its earlier install recorded", async () => {
    const { addition, targets, placed } = addToProject({
      isGithubMarketplace: true,
      flat: [TOOL.cursor],
      native: [],
      distribution: DISTRIBUTION,
      version: "1.0.0",
    });
    const projectHooks = { entries: [], scripts: new Map<string, string>() };
    const files = new Map([[".cursor/hooks/sample-plugin/run.cjs", "a".repeat(32)]]);
    targets.manifest.addTool(TOOL.cursor, "1.0.0", []);
    targets.manifest.addPlugin(
      TOOL.cursor,
      RecordedPlugin.fromJSON({
        ...RecordedPlugin.fromMetadata(SAMPLE_ENTRY).toJSON(),
        files: Object.fromEntries(files),
      }).withProjectHooks(projectHooks)
    );
    const metadata = { name: "sample-plugin", version: "1.0.0", strict: false };

    await addition.execute(
      {
        ...ADD,
        toolIds: [TOOL.cursor],
        githubMarketplace: true,
        replace: true,
        pluginMetadata: metadata,
      },
      { ...targets, toolIds: [TOOL.cursor] }
    );

    expect(placed.at(-1)?.previousProjectHooks.get(TOOL.cursor)).toStrictEqual(projectHooks);
    expect(placed.at(-1)?.previousFiles.get(TOOL.cursor)).toStrictEqual(files);
  });

  it("refuses a github marketplace add that carries no plugin metadata", async () => {
    const { addition, targets } = addToProject();

    await expect(addition.execute({ ...ADD, githubMarketplace: true }, targets)).rejects.toThrow(
      MissingPluginMetadataError
    );
  });
});
