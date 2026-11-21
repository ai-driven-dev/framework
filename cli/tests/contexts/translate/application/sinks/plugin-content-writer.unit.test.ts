import { describe, expect, it } from "vitest";
import {
  writePluginAgents,
  writePluginSkills,
} from "../../../../../src/contexts/translate/application/sinks/plugin-content-writer.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { aDiskTarget, aStubBuildContract } from "../../testing/stub-build-contract.builder.js";

const PLUGIN = { name: "plug", src: "/src/plugins/plug" };
const UNUSED_FLAT = {
  writeConfig: async () => 0,
  writeAgent: async () => 0,
  writeSkill: async () => 0,
  writeHooks: async () => 0,
  writeMcp: async () => 0,
};

describe("one plugin's agents and skills in the marketplace layout", () => {
  it("copies each agent under the plugin's output", async () => {
    const fs = new InMemoryFileAdapter({ [`${PLUGIN.src}/agents/a.md`]: "# a\n" });
    const target = aDiskTarget(aStubBuildContract());
    await expect(writePluginAgents({ fs, flat: UNUSED_FLAT }, target, PLUGIN)).resolves.toBe(1);
    expect(fs.getFile("/out/plugins/plug/agents/a.md")).toBe("# a\n");
  });

  it("leaves a file that is not an agent alone", async () => {
    const fs = new InMemoryFileAdapter({ [`${PLUGIN.src}/agents/notes.txt`]: "x" });
    const target = aDiskTarget(aStubBuildContract());
    await expect(writePluginAgents({ fs, flat: UNUSED_FLAT }, target, PLUGIN)).resolves.toBe(0);
  });

  it("copies the skill tree under the plugin's output", async () => {
    const fs = new InMemoryFileAdapter({ [`${PLUGIN.src}/skills/hi/SKILL.md`]: "# hi\n" });
    const target = aDiskTarget(aStubBuildContract());
    await expect(writePluginSkills({ fs, flat: UNUSED_FLAT }, target, PLUGIN)).resolves.toBe(1);
    expect(fs.getFile("/out/plugins/plug/skills/hi/SKILL.md")).toBe("# hi\n");
  });

  it("writes no skill for a tool that has none", async () => {
    const fs = new InMemoryFileAdapter({ [`${PLUGIN.src}/skills/hi/SKILL.md`]: "# hi\n" });
    const contract = aStubBuildContract();
    const target = aDiskTarget({
      ...contract,
      artifacts: { ...contract.artifacts, skills: { supported: false } },
    });
    await expect(writePluginSkills({ fs, flat: UNUSED_FLAT }, target, PLUGIN)).resolves.toBe(0);
  });
});
