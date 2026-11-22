import { describe, expect, it } from "vitest";
import type { AddPluginRequest } from "../../../../../src/contexts/installation/application/plugin/add/plugin-add.js";
import { AddPlugin } from "../../../../../src/contexts/installation/application/plugin/add-plugin.use-case.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { userScopeOwnership } from "../../../../../src/contexts/machine-claims/application/ownership/user-scope-ownership.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = "/test-project";
const SOURCE = { kind: "local" as const, path: "/plugin" };

function addTo(manifest: Manifest, options: { scope?: Scope } = {}) {
  const project = new InMemoryManifestRepository(manifest);
  const user = new InMemoryManifestRepository(Manifest.create());
  const placed: Array<{ toolIds: AiToolId[]; manifest: Manifest }> = [];
  const fs = new InMemoryFileAdapter();
  fs.setFile(`${PROJECT_ROOT}/.aidd/manifest.json`, "{}");
  const addToProject = {
    execute: async (
      _options: AddPluginRequest,
      targets: { toolIds: AiToolId[]; manifest: Manifest }
    ) => {
      placed.push(targets);
      for (const toolId of targets.toolIds) {
        targets.manifest.addPlugin(
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
  };
  const add = new AddPlugin(
    { ownership: userScopeOwnership(fs), manifests: { project, user }, addToProject },
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

describe("adding a plugin to a project", () => {
  it("adds the plugin for the named tools, then saves the project manifest", async () => {
    const { add, project, placed } = addTo(manifestWithClaude());

    await add.execute(ADD);

    expect([
      placed.map((p) => p.toolIds),
      project.getCurrent()?.getRecordedPlugins(TOOL.claude).length,
      project.saveCount,
    ]).toStrictEqual([[[TOOL.claude]], 1, 1]);
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
