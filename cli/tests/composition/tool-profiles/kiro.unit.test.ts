import { describe, expect, it } from "vitest";
import { kiro } from "../../../src/composition/tool-profiles/kiro.js";

describe("kiro declarations the rest of the CLI reads", () => {
  it("installs a skill one level below .kiro/skills, folder named for the plugin and skill", () => {
    expect(kiro.flatInstallPath("skills", "aidd-dev", "plan/SKILL.md")).toBe(
      ".kiro/skills/aidd-dev-plan/SKILL.md"
    );
  });

  it("installs an agent as a markdown file under .kiro/agents", () => {
    expect(kiro.flatInstallPath("agents", "aidd-dev", "explorer.md")).toBe(
      ".kiro/agents/aidd-dev-explorer.md"
    );
  });

  it("owns what it places, and no sibling plugin's folder", () => {
    expect([
      kiro.ownsFlatPath(".kiro/skills/aidd-dev-plan/SKILL.md", "aidd-dev"),
      kiro.ownsFlatPath(".kiro/agents/aidd-dev-explorer.md", "aidd-dev"),
      kiro.ownsFlatPath(".kiro/skills/other-plan/SKILL.md", "aidd-dev"),
    ]).toStrictEqual([true, true, false]);
  });

  it("writes an agent as markdown carrying a name, a description and every tool, no model", () => {
    const agents = kiro.section("agents");
    const converted = agents.convertFrontmatter(
      { name: "explorer", description: "d", model: "opus" },
      "explorer.md"
    );

    expect(agents.serialize(converted, "body")).toBe(
      "---\nname: 'explorer'\ndescription: 'd'\ntools:\n  - \"*\"\n---\nbody"
    );
  });
});
