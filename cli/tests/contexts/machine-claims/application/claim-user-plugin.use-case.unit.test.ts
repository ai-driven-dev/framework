import { describe, expect, it } from "vitest";
import { ClaimUserPlugin } from "../../../../src/contexts/machine-claims/application/claim-user-plugin.use-case.js";
import type { OwnershipMachineManifest } from "../../../../src/contexts/machine-claims/ports/machine-manifest.js";
import { ToolNotInManifestError } from "../../../../src/shared/domain/shared.error.js";
import type { AiToolId } from "../../../../src/shared/domain/tool.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { InMemoryMachineManifest } from "../testing/in-memory-machine-manifest.fake.js";
import { MachinePlugin } from "../testing/machine-plugin.fake.js";

const ROOT = "/test-project";
const tool = TOOL.claude;

class Machine extends InMemoryMachineManifest implements OwnershipMachineManifest {
  readonly added: string[] = [];
  private tools = new Set<string>();

  hasTool(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  addTool(toolId: AiToolId, version: string): void {
    this.tools.add(toolId);
    this.added.push(`${toolId}@${version}`);
  }

  withPlugin(toolId: AiToolId, plugin: MachinePlugin): void {
    const recorded = this.getRecordedPlugins(toolId).some(
      (p) => p.plugin.name === plugin.plugin.name
    );
    if (recorded) this.updatePlugin(toolId, plugin);
    else this.addPlugin(toolId, plugin);
  }
}

const userPlugin = () => new MachinePlugin({ name: "sample", files: { "a.md": "abc" } });
const ownership = new ClaimUserPlugin(new InMemoryFileAdapter({}, [ROOT]));

function claim(machine: Machine, toolVersion: string | undefined) {
  return ownership.execute({
    machine,
    toolId: tool,
    plugin: userPlugin(),
    toolVersion,
    projectRoot: ROOT,
  });
}

describe("recording a project's claim on a user-scope plugin", () => {
  it("records the plugin on the machine with the project as its holder", async () => {
    const machine = new Machine(tool);

    await claim(machine, "1.0.0");

    expect(machine.getRecordedPlugins(tool)[0]?.machineClaim).toStrictEqual([ROOT]);
  });

  it("adds the project as a holder of a plugin the machine already owns", async () => {
    const machine = new Machine(tool);
    machine.addPlugin(tool, userPlugin().withMachineClaim(["/other"]));

    await claim(machine, "1.0.0");

    expect(machine.getRecordedPlugins(tool)[0]?.machineClaim).toStrictEqual(["/other", ROOT]);
  });

  it("tracks the tool at the project's version when the machine did not", async () => {
    const machine = new Machine(tool);

    await claim(machine, "2.3.4");

    expect(machine.added).toStrictEqual([`${tool}@2.3.4`]);
  });

  it("refuses a tool the project record does not track either", async () => {
    await expect(claim(new Machine(tool), undefined)).rejects.toThrow(ToolNotInManifestError);
  });
});
