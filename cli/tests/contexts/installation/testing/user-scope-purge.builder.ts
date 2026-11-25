import { recordsOf } from "../../../../src/composition/contexts/installation.js";
import type { ToolRecords } from "../../../../src/contexts/installation/contract/records/scope-records.js";
import { RecordedPlugin } from "../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { InMemoryManifestRepository } from "../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { FakeMachineState } from "./fake-machine-state.fake.js";
import { FakeUserScopePluginFiles } from "./fake-user-scope-plugin-files.fake.js";
import { aManifest } from "./manifest.builder.js";

export const USER_SCOPE_HOME = "/fake-home";
export const USER_PLUGIN_NAME = "aidd-dev";

export function aUserPlugin() {
  return RecordedPlugin.fromJSON({
    name: USER_PLUGIN_NAME,
    source: { kind: "local", path: "/fixture" },
    version: "1.0.0",
    strict: false,
    files: { "a.md": "h1", "b.md": "h2" },
    scope: "user",
  });
}

/** The claim a record keeps for the projects holding the user plugin. */
export const heldBy = (dependents: readonly string[]) => ({
  plugin: USER_PLUGIN_NAME,
  dependents: [...dependents],
});

/** The doubles every part of a user-scope purge is built from, over one user manifest. */
export function userScopeParts(
  options: {
    manifest?: ReturnType<ReturnType<typeof aManifest>["build"]> | null;
    records?: ToolRecords;
    proven?: string[];
  } = {}
) {
  const manifest =
    options.manifest === undefined
      ? aManifest().withTool(TOOL.claude, []).withPlugin(TOOL.claude, aUserPlugin()).build()
      : options.manifest;
  const repo = new InMemoryManifestRepository(manifest, undefined, options.records);
  const files = new FakeUserScopePluginFiles(
    new Map([
      [USER_PLUGIN_NAME, new Map((options.proven ?? ["a.md", "b.md"]).map((f) => [f, "h"]))],
    ])
  );
  const machine = new FakeMachineState(["1.0.0"]);
  return {
    repo,
    files,
    machine,
    tools: registeredTools(),
    deps: {
      userManifestRepo: repo,
      claims: recordsOf(repo),
      purgeMachineState: machine,
      homeDir: () => USER_SCOPE_HOME,
      userScopePluginFiles: files,
    },
  };
}
