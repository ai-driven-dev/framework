import { describe, expect, it } from "vitest";
import { kiro } from "../../../../../../src/composition/tool-profiles/kiro.js";
import { artifactPath } from "../../../../../../src/shared/domain/materialization/artifact-path.js";
import { present } from "../../../../../shared/testing/present.builder.js";
import { supported } from "../../../testing/build-artifacts.builder.js";

describe("building Kiro's flat contract", () => {
  const artifacts = present(kiro.buildContracts.flat)().artifacts;

  it("sits a skill one level under .kiro/skills, the plugin hyphenated onto its name", () => {
    const skills = supported(artifacts.skills);
    expect(artifactPath(skills, "aidd-dev", "skills/01-plan/SKILL.md")).toBe(
      ".kiro/skills/aidd-dev-01-plan/SKILL.md"
    );
    expect(skills.rewriteSkillName).toBe(true);
  });

  it("sits an agent as a markdown file under .kiro/agents", () => {
    expect(artifactPath(supported(artifacts.agents), "aidd-dev", "agents/explorer.md")).toBe(
      ".kiro/agents/aidd-dev-explorer.md"
    );
  });

  it("places hook scripts under .kiro/hooks/<plugin>/ and merges them into .kiro/hooks/aidd.json", () => {
    const hooks = supported(artifacts.hooks);

    expect(artifactPath(hooks, "aidd-context", "hooks/memory.cjs")).toBe(
      ".kiro/hooks/aidd-context/memory.cjs"
    );
    expect(hooks.hooksFile?.at).toEqual({ shared: ".kiro/hooks/aidd.json" });
  });

  it("delivers no MCP", () => {
    expect(artifacts.mcp.supported).toBe(false);
  });
});
