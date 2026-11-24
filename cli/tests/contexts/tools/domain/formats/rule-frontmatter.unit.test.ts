import { describe, expect, it } from "vitest";
import {
  asMdc,
  descriptionOnlyRule,
  globsScopedRule,
} from "../../../../../src/contexts/tools/domain/formats/rule-frontmatter.js";
import { rulesRows, WRITES_NOTHING } from "../../testing/profile-tables.builder.js";

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

describe("a rule scoped by a globs string", () => {
  it.each(
    rulesRows({
      ...WRITES_NOTHING,
      "a paths list": { globs: '["a", "b"]', alwaysApply: false },
      "globs that apply on request": { description: "d", globs: '["a"]', alwaysApply: false },
      "paths beside a description": { description: "d", globs: '["a"]', alwaysApply: false },
      "a description that opts out of always-apply": { description: "d", alwaysApply: false },
    })
  )("converts %s", (_case, frontmatter, expected) => {
    expect(globsScopedRule(frontmatter)).toStrictEqual(expected);
  });

  it("names a markdown rule file .mdc where it is installed, and leaves any other name as it is", () => {
    const mdc = asMdc((fileName) => `rules/${fileName}`);
    expect([mdc("a/naming.md"), mdc("a/naming.txt")]).toStrictEqual([
      "rules/a/naming.mdc",
      "rules/a/naming.txt",
    ]);
  });
});
