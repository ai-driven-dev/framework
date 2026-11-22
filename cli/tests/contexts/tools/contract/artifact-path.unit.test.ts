import { describe, expect, it } from "vitest";
import { artifactPath } from "../../../../src/contexts/tools/contract/artifact-path.js";
import type { SupportedArtifact } from "../../../../src/contexts/tools/contract/build-contract.js";
import { flatArtifactLayout } from "../../../../src/shared/domain/materialization/flat-paths.js";

const layout = flatArtifactLayout(".t/", { skills: "nested", agent: { ext: ".md" } });

describe("artifactPath", () => {
  it("places a skills artifact from its layout", () => {
    const skills: SupportedArtifact = {
      supported: true,
      source: { kind: "fullTree", srcDir: "skills" },
      layout,
    };

    expect(artifactPath(skills, "p", "skills/x/SKILL.md")).toBe(".t/skills/p/x/SKILL.md");
  });

  it("places an agents artifact from its layout, named by plugin and file", () => {
    const agents: SupportedArtifact = {
      supported: true,
      source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
      layout,
    };

    expect(artifactPath(agents, "p", "agents/a.md")).toBe(".t/agents/p-a.md");
  });

  it("places any other artifact by its own path rule", () => {
    const mcp: SupportedArtifact = {
      supported: true,
      source: { kind: "configFile", srcPath: ".mcp.json" },
      path: (plugin, rel) => `${plugin}/${rel}`,
    };

    expect(artifactPath(mcp, "p", "x")).toBe("p/x");
  });

  it("refuses an artifact that declares no placement", () => {
    const none: SupportedArtifact = {
      supported: true,
      source: { kind: "configFile", srcPath: ".mcp.json" },
    };

    expect(() => artifactPath(none, "p", "x")).toThrow("declares no placement");
  });
});
