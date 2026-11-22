import { describe, expect, it } from "vitest";
import {
  pluginsInstalledBefore,
  recordUserScopeOwnership,
} from "../../../../../../src/contexts/installation/application/plugin/add/user-scope-claims.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

const ROOT = "/test-project";

function userPlugin(files: Record<string, string>): RecordedPlugin {
  return RecordedPlugin.fromJSON({
    name: "sample",
    source: { kind: "local", path: "/plugin" },
    version: "1.0.0",
    strict: false,
    files,
    scope: "user",
  });
}

function project(plugin: RecordedPlugin): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  manifest.addPlugin(TOOL.claude, plugin);
  return manifest;
}

const FILES = { "a.md": "abc" };

async function claim(manifest: Manifest, machine: Manifest, installedBefore: ReadonlySet<string>) {
  return recordUserScopeOwnership(new InMemoryFileAdapter({}, [ROOT]), {
    project: manifest,
    machine,
    toolIds: [TOOL.claude],
    projectRoot: ROOT,
    installedBefore,
  });
}

describe("pluginsInstalledBefore", () => {
  it("keys every plugin the manifest holds for the targeted tools", () => {
    const keys = pluginsInstalledBefore(project(userPlugin(FILES)), [TOOL.claude]);

    expect([...keys]).toStrictEqual([`${TOOL.claude}/sample`]);
  });
});

describe("recordUserScopeOwnership", () => {
  it("moves a newly added user-scope plugin and its files to the machine manifest", async () => {
    const manifest = project(userPlugin(FILES));
    const machine = Manifest.create();

    expect(await claim(manifest, machine, new Set())).toBe(true);

    const [owned] = machine.getRecordedPlugins(TOOL.claude);
    expect(owned?.plugin.files.size).toBe(1);
    expect(owned?.dependents).toStrictEqual([ROOT]);
    expect(manifest.getRecordedPlugins(TOOL.claude)[0]?.plugin.files.size).toBe(0);
  });

  it("leaves a plugin installed before this add, or one with no files, with the project", async () => {
    const before = project(userPlugin(FILES));
    const empty = project(userPlugin({}));

    expect(await claim(before, Manifest.create(), new Set([`${TOOL.claude}/sample`]))).toBe(false);
    expect(await claim(empty, Manifest.create(), new Set())).toBe(false);
  });

  it("adds the project as a dependent of a plugin the machine already owns", async () => {
    const machine = Manifest.create();
    machine.addTool(TOOL.claude, "1.0.0", []);
    machine.addPlugin(TOOL.claude, userPlugin(FILES).withDependents(["/other"]));

    await claim(project(userPlugin(FILES)), machine, new Set([`${TOOL.claude}/sample`]));

    expect(machine.getRecordedPlugins(TOOL.claude)[0]?.dependents).toStrictEqual(["/other", ROOT]);
  });
});
