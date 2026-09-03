import { describe, expect, it } from "vitest";
import { convertMistralSkillFrontmatter } from "../../../../../src/contexts/tools/domain/profiles/mistral/mistral-skill-frontmatter.js";

describe("convertMistralSkillFrontmatter", () => {
  it("keeps name and description and marks the skill user-invocable", () => {
    expect(
      convertMistralSkillFrontmatter({
        name: "01-plan",
        description: "Turn a request into a plan",
        "argument-hint": "request | ticket",
      })
    ).toEqual({
      name: "01-plan",
      description: "Turn a request into a plan",
      "user-invocable": true,
    });
  });

  it("marks a skill user-invocable even when name and description are absent", () => {
    expect(convertMistralSkillFrontmatter({})).toEqual({ "user-invocable": true });
  });
});
