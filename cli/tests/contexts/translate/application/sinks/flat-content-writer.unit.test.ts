import { describe, expect, it } from "vitest";
import { writeFlatSkill } from "../../../../../src/contexts/translate/application/sinks/flat-content-writer.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import {
  aDiskTarget,
  aStubBuildContract,
  aSupportedArtifact,
} from "../../testing/stub-build-contract.builder.js";

const SKILLS = "/src/plugins/plug/skills";

function stepFor(file: string, over: Parameters<typeof aSupportedArtifact>[0] = {}) {
  const artifact = aSupportedArtifact({ path: (_p, rel) => `flat/${rel}`, ...over });
  if (!artifact.supported) throw new Error("stub artifact is supported");
  return {
    target: aDiskTarget(aStubBuildContract(), { mode: "flat" }),
    artifact,
    pluginName: "plug",
    absPath: `${SKILLS}/${file}`,
    srcRoot: SKILLS,
  };
}

describe("one flat skill file", () => {
  it("copies a file that is not markdown as it is", async () => {
    const fs = new InMemoryFileAdapter({ [`${SKILLS}/hello/data.json`]: "{}" });
    await expect(writeFlatSkill(fs, stepFor("hello/data.json"))).resolves.toBe(1);
    expect(fs.getFile("/out/flat/skills/hello/data.json")).toBe("{}");
  });

  it("renames the skill after its folder when the tool asks for it", async () => {
    const fs = new InMemoryFileAdapter({
      [`${SKILLS}/hello/SKILL.md`]: "---\nname: 01-hello\n---\nbody\n",
    });
    await writeFlatSkill(fs, stepFor("hello/SKILL.md", { rewriteSkillName: true }));
    expect(fs.getFile("/out/flat/skills/hello/SKILL.md")).toContain("name: 'hello'");
  });
});
