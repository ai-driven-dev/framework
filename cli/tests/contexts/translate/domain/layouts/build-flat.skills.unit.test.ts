import { describe, expect, it } from "vitest";
import { skillsIn } from "../../../../../src/contexts/tools/contract/artifact-path.js";
import { FrameworkPlaceholderInPluginError } from "../../../../../src/contexts/translate/contract/translate.error.js";
import { flatArtifactLayout } from "../../../../../src/shared/domain/materialization/flat-paths.js";
import { translateBuildLayout } from "../../../../shared/testing/build-files.builder.js";
import { aCanon } from "../../testing/canon-distribution.builder.js";
import { CLAUDE_ROOT_TOKEN } from "../../testing/engine-kit.builder.js";
import {
  aStubBuildContract,
  aSupportedArtifact,
} from "../../testing/stub-build-contract.builder.js";

const PLUGIN = "plug";
const FLAT_LAYOUT = flatArtifactLayout("flat/", { skills: "nested", agent: { ext: ".md" } });

function flatSkills(
  files: Record<string, string>,
  over: Parameters<typeof aSupportedArtifact>[0] = {}
) {
  const contract = aStubBuildContract();
  const skills = aSupportedArtifact({ placement: skillsIn(FLAT_LAYOUT), ...over });
  const built = translateBuildLayout(
    aCanon(PLUGIN, files),
    {
      ...contract,
      artifacts: {
        ...contract.artifacts,
        skills,
        agents: { supported: false, reason: "off in this test" },
        hooks: { supported: false, reason: "off in this test" },
        mcp: { supported: false, reason: "off in this test" },
      },
    },
    "flat"
  );
  return Object.fromEntries(built.map((file) => [file.relativePath, file.content]));
}

describe("the flat layout of a plugin's skills", () => {
  it("copies a file that is not markdown as it is, where the tool's path puts it", () => {
    expect(flatSkills({ "skills/hello/data.json": "{}" })).toEqual({
      "flat/skills/plug/hello/data.json": "{}",
    });
  });

  it("renames the skill after its folder when the tool asks for it", () => {
    const built = flatSkills(
      { "skills/hello/SKILL.md": "---\nname: 01-hello\n---\nbody\n" },
      { rewriteSkillName: true }
    );
    expect(built["flat/skills/plug/hello/SKILL.md"]).toContain("name: 'hello'");
  });

  it("keeps the skill's own name when the tool does not ask for the folder's", () => {
    const built = flatSkills({ "skills/hello/SKILL.md": "---\nname: 01-hello\n---\nbody\n" });
    expect(built["flat/skills/plug/hello/SKILL.md"]).toContain("name: 01-hello");
  });

  it("points a plugin-root reference from where the flat skill file lands", () => {
    const built = flatSkills({
      "skills/hello/SKILL.md": `See @${CLAUDE_ROOT_TOKEN}/agents/x.md\n`,
    });
    expect(built["flat/skills/plug/hello/SKILL.md"]).toBe("See [x.md](../../../../agents/x.md)\n");
  });

  it("refuses a skill naming the framework's tools placeholder", () => {
    expect(() =>
      flatSkills({ "skills/hello/SKILL.md": "See @{{TOOLS}}/agents/planner.md.\n" })
    ).toThrow(new FrameworkPlaceholderInPluginError(PLUGIN, "hello/SKILL.md"));
  });
});
