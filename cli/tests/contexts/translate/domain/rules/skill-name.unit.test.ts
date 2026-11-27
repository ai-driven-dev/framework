import { describe, expect, it } from "vitest";
import { namedAfterFolder } from "../../../../../src/contexts/translate/domain/rules/skill-name.js";

const SKILL = "---\nname: old\ndescription: Does it\n---\nBody\n";

describe("naming a skill after its folder", () => {
  it("names the skill after the folder its entry sits in", () => {
    expect(namedAfterFolder(SKILL, ".github/skills/aidd-dev-01-plan/SKILL.md")).toBe(
      "---\nname: 'aidd-dev-01-plan'\ndescription: 'Does it'\n---\nBody\n"
    );
  });

  it("leaves a file with no folder as it is", () => {
    expect(namedAfterFolder(SKILL, "SKILL.md")).toBe(SKILL);
  });
});
