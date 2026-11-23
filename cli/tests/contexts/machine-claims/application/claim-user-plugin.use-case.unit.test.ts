import { describe, expect, it } from "vitest";
import { ClaimUserPlugin } from "../../../../src/contexts/machine-claims/application/claim-user-plugin.use-case.js";
import type { OwnershipMachineManifest } from "../../../../src/contexts/machine-claims/ports/machine-manifest.js";
import { ToolNotInManifestError } from "../../../../src/shared/domain/shared.error.js";
import type { AiToolId } from "../../../../src/shared/domain/tool.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import {
  InMemoryMachineManifest,
  InMemoryMachineManifestRepository,
} from "../testing/in-memory-machine-manifest.fake.js";
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
const ownership = (records: InMemoryMachineManifestRepository) =>
  new ClaimUserPlugin(new InMemoryFileAdapter({}, [ROOT]), records);

function claim(
  machine: Machine,
  toolVersion: string | undefined,
  records = new InMemoryMachineManifestRepository(machine)
) {
  return ownership(records).execute({
    machine,
    toolId: tool,
    plugin: userPlugin(),
    toolVersion,
    projectRoot: ROOT,
  });
}

describe("recording a project's claim on a user-scope plugin", () => {
  it("records the plugin on the machine, the project holding it in the tool's claims", async () => {
    const machine = new Machine(tool);
    const records = new InMemoryMachineManifestRepository(machine);

    await claim(machine, "1.0.0", records);

    expect(machine.getRecordedPlugins(tool)).toHaveLength(1);
    expect(records.records.get(tool)?.pluginClaims).toStrictEqual([
      { plugin: "sample", dependents: [ROOT] },
    ]);
  });

  it("adds the project as a holder of a plugin the machine already owns, beside the claims held", async () => {
    const machine = new Machine(tool);
    machine.addPlugin(tool, userPlugin());
    const ref = { ref: "a@catalog", dependents: ["/ref"] };
    const records = new InMemoryMachineManifestRepository(
      machine,
      new Map([
        [
          tool,
          { binary: "claude", pluginClaims: [{ plugin: "sample", dependents: ["/other"] }, ref] },
        ],
      ])
    );

    await claim(machine, "1.0.0", records);

    expect(records.records.get(tool)).toStrictEqual({
      binary: "claude",
      pluginClaims: [{ plugin: "sample", dependents: ["/other", ROOT] }, ref],
    });
    expect(records.recordSaveCount).toBe(1);
  });

  it("keeps the host data and the claims on refs of a record it opens a plugin claim in", async () => {
    const machine = new Machine(tool);
    const ref = { ref: "a@catalog", dependents: ["/ref"] };
    const records = new InMemoryMachineManifestRepository(
      machine,
      new Map([[tool, { binary: "claude", pluginClaims: [ref] }]])
    );

    await claim(machine, "1.0.0", records);

    expect(records.records.get(tool)).toStrictEqual({
      binary: "claude",
      pluginClaims: [ref, { plugin: "sample", dependents: [ROOT] }],
    });
  });

  it("tracks the tool at the project's version when the machine did not", async () => {
    const machine = new Machine(tool);

    await claim(machine, "2.3.4");

    expect(machine.added).toStrictEqual([`${tool}@2.3.4`]);
  });

  it("refuses a tool the project record does not track either, writing no claim", async () => {
    const machine = new Machine(tool);
    const records = new InMemoryMachineManifestRepository(machine);

    await expect(claim(machine, undefined, records)).rejects.toThrow(ToolNotInManifestError);
    expect(records.recordSaveCount).toBe(0);
  });
});
