import { describe, expect, it } from "vitest";
import { FrameworkPlaceholderInPluginError } from "../../../../../src/contexts/translate/domain/translate.error.js";
import { translateBuildLayout } from "../../../../shared/testing/build-files.builder.js";
import { aCanon } from "../../testing/canon-distribution.builder.js";
import {
  aStubBuildContract,
  aSupportedArtifact,
} from "../../testing/stub-build-contract.builder.js";

const PLUGIN = "plug";

function agentsBuilt(files: Record<string, string>, agents = aSupportedArtifact()) {
  const contract = aStubBuildContract();
  const built = translateBuildLayout(
    aCanon(PLUGIN, files),
    {
      ...contract,
      artifacts: {
        ...contract.artifacts,
        agents,
        skills: { supported: false, reason: "off in this test" },
      },
    },
    "marketplace"
  );
  return Object.fromEntries(built.map((file) => [file.relativePath, file.content]));
}

describe("the marketplace layout of a plugin's agents", () => {
  it("copies each agent under the plugin's output", () => {
    expect(agentsBuilt({ "agents/a.md": "# a\n" })).toEqual({
      "plugins/plug/agents/a.md": "# a\n",
    });
  });

  it("leaves a file that is not an agent alone", () => {
    expect(agentsBuilt({ "agents/notes.txt": "x" })).toEqual({});
  });

  it("lands a nested agent by its file name alone, where the tool's path puts it", () => {
    const agents = aSupportedArtifact({
      placement: { kind: "agentFiles", dir: "built/agents", ext: ".md" },
    });
    expect(agentsBuilt({ "agents/sub/deep.md": "# deep\n" }, agents)).toEqual({
      "plugins/plug/built/agents/deep.md": "# deep\n",
    });
  });

  it("hands each agent to the tool's transform with the plugin and the file name", () => {
    const transform = (content: string, plugin: string, base: string) =>
      `${plugin}:${base}\n${content}`;
    expect(agentsBuilt({ "agents/a.md": "# a\n" }, aSupportedArtifact({ transform }))).toEqual({
      "plugins/plug/agents/a.md": "plug:a.md\n# a\n",
    });
  });

  it("refuses an agent naming the framework's tools placeholder, by its path in agents", () => {
    expect(() => agentsBuilt({ "agents/sub/a.md": "See @{{TOOLS}}/x.md.\n" })).toThrow(
      new FrameworkPlaceholderInPluginError(PLUGIN, "sub/a.md")
    );
  });

  it("builds no agent for a tool that has none", () => {
    expect(
      agentsBuilt({ "agents/a.md": "# a\n" }, { supported: false, reason: "off in this test" })
    ).toEqual({});
  });
});
