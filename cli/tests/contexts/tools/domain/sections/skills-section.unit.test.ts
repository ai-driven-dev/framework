import { describe, expect, it } from "vitest";
import { SkillsSection } from "../../../../../src/contexts/tools/domain/sections/skills-section.js";

describe("a skills section", () => {
  it("names the two options it needs", () => {
    expect(() => new SkillsSection({})).toThrow(
      expect.objectContaining({
        detail: expect.stringContaining(
          "SkillsSection requires either agentsSkillsDirectory or directory"
        ),
      })
    );
  });
});
