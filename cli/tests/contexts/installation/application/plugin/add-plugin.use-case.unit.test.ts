import { describe, expect, it } from "vitest";
import type { PlacePluginRequest } from "../../../../../src/contexts/installation/application/plugin/add/place-plugin.use-case.js";
import type { AddPluginRequest } from "../../../../../src/contexts/installation/application/plugin/add/plugin-add.js";
import { AddPlugin } from "../../../../../src/contexts/installation/application/plugin/add-plugin.use-case.js";
import {
  DuplicatePluginError,
  MissingPluginMetadataError,
} from "../../../../../src/contexts/installation/domain/installation.error.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { userScopeOwnership } from "../../../../../src/contexts/machine-claims/application/ownership/user-scope-ownership.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
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

function addTo(manifest: Manifest, options: { scope?: Scope } = {}) {
  const project = new InMemoryManifestRepository(manifest);
  const user = new InMemoryManifestRepository(Manifest.create());
  const placed: PlacePluginRequest[] = [];
  const fs = new InMemoryFileAdapter();
  fs.setFile(`${PROJECT_ROOT}/.aidd/manifest.json`, "{}");
  const add = new AddPlugin(
    {
      fs,
      ownership: userScopeOwnership(fs),
      manifests: { project, user },
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
                scope: options.scope ?? "project",
              }).withFiles(
                options.scope === "user"
                  ? new Map([["skills/a.md", `sha256:${"a".repeat(64)}`]])
                  : new Map()
              )
            );
          }
        },
      },
    },
    registeredTools()
  );
  return { add, project, user, placed };
}

function manifestWithClaude(): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  return manifest;
}

const ADD: AddPluginRequest = {
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
      project.getCurrent()?.getRecordedPlugins(TOOL.claude).length,
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

  it("characterizes the known orphan claim: the machine save stays when the project save fails", async () => {
    const { add, project, user } = addTo(manifestWithClaude(), { scope: "user" });
    project.save = async () => {
      throw new Error("disk full");
    };

    await expect(add.execute(ADD)).rejects.toThrow("disk full");

    const claimed = user.getCurrent()?.getRecordedPlugins(TOOL.claude);
    expect([user.saveCount, claimed?.map((p) => [p.plugin.name, p.machineClaim])]).toStrictEqual([
      1,
      [["sample-plugin", [PROJECT_ROOT]]],
    ]);
  });
});
