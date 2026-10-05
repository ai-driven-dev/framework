import { describe, expect, it } from "vitest";
import type { ArtifactContract } from "../../../../../../src/contexts/tools/domain/build-contract.js";
import { buildAntigravityFlatContract } from "../../../../../../src/contexts/tools/domain/profiles/antigravity/build.js";

function supported(artifact: ArtifactContract): Extract<ArtifactContract, { supported: true }> {
  if (!artifact.supported) throw new Error("artifact is declared unsupported");
  return artifact;
}

describe("buildAntigravityFlatContract", () => {
  it("sits a skill one level under .agents/skills, the plugin hyphenated onto its name", () => {
    const skills = supported(buildAntigravityFlatContract().artifacts.skills);
    expect(skills.path("aidd-dev", "skills/01-plan/SKILL.md")).toBe(
      ".agents/skills/aidd-dev-01-plan/SKILL.md"
    );
    expect(skills.rewriteSkillName).toBe(true);
    expect(skills.source).toEqual({ kind: "fullTree", srcDir: "skills" });
  });

  it.each(["agents", "hooks", "mcp", "rules", "commands"] as const)(
    "declares %s unsupported",
    (kind) => {
      expect(buildAntigravityFlatContract().artifacts[kind].supported).toBe(false);
    }
  );

  it("writes no manifest, catalog or config artifact", () => {
    const contract = buildAntigravityFlatContract();
    expect(contract.manifestFileRelative).toBeNull();
    expect(contract.buildMarketplaceCatalog).toBeNull();
    expect(contract.emitConfigArtifact).toBeUndefined();
  });
});
