import { describe, expect, it } from "vitest";
import { descriptionOnlyRule } from "../../../../../src/contexts/tools/domain/formats/rule-frontmatter.js";

describe("keeping only a rule's description", () => {
  it("keeps the description of an on-request rule and nothing else", () => {
    expect(
      descriptionOnlyRule({ alwaysApply: false, description: "When asked", paths: ["a/**"] })
    ).toStrictEqual({ description: "When asked" });
  });

  it("drops everything from a rule that always applies or has no description", () => {
    expect([
      descriptionOnlyRule({ alwaysApply: true, description: "x" }),
      descriptionOnlyRule({ alwaysApply: false }),
    ]).toStrictEqual([{}, {}]);
  });
});
