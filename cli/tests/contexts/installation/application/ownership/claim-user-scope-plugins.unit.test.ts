import { describe, expect, it } from "vitest";
import {
  claimUserScopePlugins,
  pluginsHeld,
} from "../../../../../src/contexts/installation/application/ownership/claim-user-scope-plugins.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const ROOT = "/project";
const tool = TOOL.claude;
const FILES = new Map([["skills/a.md", `sha256:${"a".repeat(64)}`]]);

const userPlugin = (files: ReadonlyMap<string, string> = FILES) =>
  RecordedPlugin.fromMetadata({
    name: "sample",
    version: "1.0.0",
    source: { kind: "local", path: "/plugin" },
    strict: false,
    scope: "user",
  }).withFiles(files);

function manifestHolding(plugin?: RecordedPlugin): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(tool, "1.0.0", []);
  if (plugin) manifest.addPlugin(tool, plugin);
  return manifest;
}

function claimIn(project: Manifest, options: { machine?: Manifest; heldBefore?: string[] } = {}) {
  const machine = options.machine ?? manifestHolding();
  const recorded: string[] = [];
  const ownership = {
    record: async (claim: { plugin: RecordedPlugin }) => {
      recorded.push(claim.plugin.plugin.name);
    },
  };
  const moved = claimUserScopePlugins(ownership, {
    project,
    machine,
    toolIds: [tool],
    projectRoot: ROOT,
    heldBefore: new Set(options.heldBefore ?? []),
  });
  return { moved, recorded };
}

const filesKept = (project: Manifest) => project.getRecordedPlugins(tool)[0]?.plugin.files.size;

describe("keying the plugins a project holds", () => {
  it("names every plugin of the targeted tools by tool and name", () => {
    expect([...pluginsHeld(manifestHolding(userPlugin()), [tool])]).toStrictEqual([
      `${tool}/sample`,
    ]);
  });
});

describe("handing user-scope plugins to the machine", () => {
  it("claims a plugin this add installed with files, and drops its files from the project", async () => {
    const project = manifestHolding(userPlugin());
    const { moved, recorded } = claimIn(project);

    expect(await moved).toBe(true);
    expect([recorded, filesKept(project)]).toStrictEqual([["sample"], 0]);
  });

  it("leaves a plugin the project held before the add with the project", async () => {
    const project = manifestHolding(userPlugin());
    const { moved, recorded } = claimIn(project, { heldBefore: [`${tool}/sample`] });

    expect([await moved, recorded, filesKept(project)]).toStrictEqual([false, [], 1]);
  });

  it("leaves a plugin with no files with the project", async () => {
    const project = manifestHolding(userPlugin(new Map()));
    const { moved, recorded } = claimIn(project);

    expect([await moved, recorded]).toStrictEqual([false, []]);
  });

  it("claims a plugin the machine already holds, even one the project held before", async () => {
    const project = manifestHolding(userPlugin());
    const { moved, recorded } = claimIn(project, {
      machine: manifestHolding(userPlugin()),
      heldBefore: [`${tool}/sample`],
    });

    expect([await moved, recorded]).toStrictEqual([true, ["sample"]]);
  });
});
