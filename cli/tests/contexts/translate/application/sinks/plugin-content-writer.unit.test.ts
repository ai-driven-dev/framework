import { describe, expect, it } from "vitest";
import {
  writePluginAgents,
  writePluginSkills,
} from "../../../../../src/contexts/translate/application/sinks/plugin-content-writer.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { aDiskTarget, aStubBuildContract } from "../../testing/stub-build-contract.builder.js";

const PLUGIN = { name: "plug", src: "/src/plugins/plug" };
const written: string[] = [];
const RECORDING_FLAT = {
  writeConfig: async () => 0,
  writeAgent: async (step: { absPath: string }) => written.push(step.absPath),
  writeSkill: async (step: { absPath: string }) => written.push(step.absPath),
  writeHooks: async () => 0,
  writeMcp: async () => 0,
};
const FILES = {
  [`${PLUGIN.src}/agents/a.md`]: "# a\n",
  [`${PLUGIN.src}/agents/notes.txt`]: "x",
  [`${PLUGIN.src}/skills/hi/SKILL.md`]: "# hi\n",
};

describe("one plugin's agents and skills, written flat", () => {
  it("hands each agent markdown file to the flat writer, and no other file", async () => {
    written.length = 0;
    const fs = new InMemoryFileAdapter(FILES);
    const target = aDiskTarget(aStubBuildContract(), { mode: "flat" });
    await expect(writePluginAgents({ fs, flat: RECORDING_FLAT }, target, PLUGIN)).resolves.toBe(1);
    expect(written).toEqual([`${PLUGIN.src}/agents/a.md`]);
  });

  it("hands each skill file to the flat writer", async () => {
    written.length = 0;
    const fs = new InMemoryFileAdapter(FILES);
    const target = aDiskTarget(aStubBuildContract(), { mode: "flat" });
    await expect(writePluginSkills({ fs, flat: RECORDING_FLAT }, target, PLUGIN)).resolves.toBe(1);
    expect(written).toEqual([`${PLUGIN.src}/skills/hi/SKILL.md`]);
  });

  it("writes nothing in the marketplace layout, which the engine builds", async () => {
    written.length = 0;
    const fs = new InMemoryFileAdapter(FILES);
    const target = aDiskTarget(aStubBuildContract());
    const deps = { fs, flat: RECORDING_FLAT };
    await expect(writePluginAgents(deps, target, PLUGIN)).resolves.toBe(0);
    await expect(writePluginSkills(deps, target, PLUGIN)).resolves.toBe(0);
    expect(written).toEqual([]);
  });
});
