import { describe, expect, it } from "vitest";
import { skillsIn } from "../../../../../src/contexts/tools/contract/artifact-path.js";
import { FrameworkPlaceholderInPluginError } from "../../../../../src/contexts/translate/domain/translate.error.js";
import { flatArtifactLayout } from "../../../../../src/shared/domain/materialization/flat-paths.js";
import { translateBuildLayout } from "../../../../shared/testing/build-files.builder.js";
import { aCanon } from "../../testing/canon-distribution.builder.js";
import { CLAUDE_ROOT_TOKEN } from "../../testing/engine-kit.builder.js";
import {
  aStubBuildContract,
  aSupportedArtifact,
} from "../../testing/stub-build-contract.builder.js";

const PLUGIN = "plug";
const FLAT = { placement: { kind: "agentFiles", dir: "flat/agents", ext: ".md" } } as const;

function flatAgents(
  files: Record<string, string>,
  over: Parameters<typeof aSupportedArtifact>[0] = {}
) {
  const contract = aStubBuildContract();
  const built = translateBuildLayout(
    aCanon(PLUGIN, files),
    {
      ...contract,
      artifacts: {
        ...contract.artifacts,
        agents: aSupportedArtifact({ ...FLAT, ...over }),
        skills: aSupportedArtifact({
          placement: skillsIn(
            flatArtifactLayout("flat/", { skills: "nested", agent: { ext: ".md" } })
          ),
        }),
        hooks: { supported: false, reason: "off in this test" },
        mcp: { supported: false, reason: "off in this test" },
      },
    },
    "flat"
  );
  return Object.fromEntries(built.map((file) => [file.relativePath, file.content]));
}

describe("the flat layout of a plugin's agents", () => {
  it("lands an agent by its file name alone, whatever folder holds it", () => {
    expect(flatAgents({ "agents/sub/deep.md": "# deep\n" })).toEqual({
      "flat/agents/deep.md": "# deep\n",
    });
  });

  it("leaves a file that is not an agent alone", () => {
    expect(flatAgents({ "agents/notes.txt": "x" })).toEqual({});
  });

  it("points a plugin-root reference in its body from where the agent lands", () => {
    const built = flatAgents({
      "agents/a.md": `---\nname: a\n---\nSee @${CLAUDE_ROOT_TOKEN}/skills/x/SKILL.md\n`,
    });
    expect(built["flat/agents/a.md"]).toContain("See [SKILL.md](../skills/plug/x/SKILL.md)");
  });

  it("hands the agent to the tool's transform instead of resolving its links", () => {
    const transform = (content: string, plugin: string, base: string) =>
      `${plugin}:${base}:${content}`;
    expect(flatAgents({ "agents/sub/a.md": "# a\n" }, { transform })).toEqual({
      "flat/agents/a.md": "plug:a.md:# a\n",
    });
  });

  it("refuses an agent naming the framework's tools placeholder, by its path in the plugin", () => {
    expect(() => flatAgents({ "agents/sub/a.md": "See @{{TOOLS}}/x.md.\n" })).toThrow(
      new FrameworkPlaceholderInPluginError(PLUGIN, "agents/sub/a.md")
    );
  });
});
