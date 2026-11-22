import { describe, expect, it } from "vitest";
import { userScopeOwnership } from "../../../../../src/contexts/machine-claims/application/ownership/user-scope-ownership.js";
import type {
  OwnershipMachineManifest,
  OwnershipProjectManifest,
} from "../../../../../src/contexts/machine-claims/ports/machine-manifest.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { InMemoryMachineManifest } from "../../testing/in-memory-machine-manifest.fake.js";
import { MachinePlugin } from "../../testing/machine-plugin.fake.js";

const ROOT = "/test-project";
const FILES = { "a.md": "abc" };
const tool = TOOL.claude;

class Project implements OwnershipProjectManifest {
  private held: MachinePlugin[];

  constructor(plugin: MachinePlugin) {
    this.held = [plugin];
  }

  getPlugins() {
    return this.held.map((held) => held.plugin);
  }

  getRecordedPlugins(): readonly MachinePlugin[] {
    return this.held;
  }

  updatePlugin(_toolId: AiToolId, plugin: MachinePlugin): void {
    this.held = this.held.map((held) => (held.name === plugin.name ? plugin : held));
  }

  getToolVersion(): string {
    return "1.0.0";
  }
}

class Machine extends InMemoryMachineManifest implements OwnershipMachineManifest {
  private tools = new Set<string>();

  hasTool(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  addTool(toolId: AiToolId): void {
    this.tools.add(toolId);
  }

  withPlugin(toolId: AiToolId, plugin: MachinePlugin): void {
    const recorded = this.getRecordedPlugins(toolId).some(
      (p) => p.plugin.name === plugin.plugin.name
    );
    if (recorded) this.updatePlugin(toolId, plugin);
    else this.addPlugin(toolId, plugin);
  }
}

const userPlugin = (files: Record<string, string>) => new MachinePlugin({ name: "sample", files });
const ownership = userScopeOwnership(new InMemoryFileAdapter({}, [ROOT]));

function claim(project: Project, machine: Machine, installedBefore: ReadonlySet<string>) {
  return ownership.record({
    project,
    machine,
    toolIds: [tool],
    projectRoot: ROOT,
    installedBefore,
  });
}

describe("installedBefore", () => {
  it("keys every plugin the manifest holds for the targeted tools", () => {
    const keys = ownership.installedBefore(new Project(userPlugin(FILES)), [tool]);

    expect([...keys]).toStrictEqual([`${tool}/sample`]);
  });
});

describe("record", () => {
  it("moves a newly added user-scope plugin and its files to the machine manifest", async () => {
    const project = new Project(userPlugin(FILES));
    const machine = new Machine(tool);

    expect(await claim(project, machine, new Set())).toBe(true);

    const [owned] = machine.getRecordedPlugins(tool);
    expect(owned?.dependents).toStrictEqual([ROOT]);
    expect(project.getRecordedPlugins()[0]?.plugin.files.size).toBe(0);
  });

  it("leaves a plugin installed before this add, or one with no files, with the project", async () => {
    const before = new Project(userPlugin(FILES));
    const empty = new Project(userPlugin({}));

    expect(await claim(before, new Machine(tool), new Set([`${tool}/sample`]))).toBe(false);
    expect(await claim(empty, new Machine(tool), new Set())).toBe(false);
  });

  it("adds the project as a dependent of a plugin the machine already owns", async () => {
    const machine = new Machine(tool);
    machine.addPlugin(tool, userPlugin(FILES).withDependents(["/other"]));

    await claim(new Project(userPlugin(FILES)), machine, new Set([`${tool}/sample`]));

    expect(machine.getRecordedPlugins(tool)[0]?.dependents).toStrictEqual(["/other", ROOT]);
  });
});
