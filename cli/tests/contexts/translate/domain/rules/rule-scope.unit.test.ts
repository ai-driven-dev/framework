import { describe, expect, it } from "vitest";
import { applyPlan } from "../../../../../src/contexts/translate/domain/rules/component-pipeline.js";
import {
  ruleScope,
  scopeStated,
} from "../../../../../src/contexts/translate/domain/rules/rule-scope.js";

describe("the scope a rule declares", () => {
  it("reads the globs of its paths, none when it declares no list", () => {
    expect([
      ruleScope('---\npaths:\n  - "**/*.ts"\n  - "**/*.tsx"\n---\n# T\n'),
      ruleScope("---\ndescription: x\n---\n# T\n"),
      ruleScope("---\npaths: src/*.ts\n---\n# T\n"),
      ruleScope("# T\n"),
    ]).toStrictEqual([["**/*.ts", "**/*.tsx"], [], [], []]);
  });
});

describe("stating a rule's scope in its body", () => {
  const plan = (content: string) => ({ source: "rules/a.md", path: "out/a.md", content });

  it("drops the frontmatter and opens the body with the globs it applied to", () => {
    const stated = scopeStated(plan("---\ndescription: x\npaths: [a]\n---\nBody\n"), [
      "src/*.ts",
      "lib/*.ts",
    ]);

    expect(applyPlan(stated).content).toBe(
      "Applies to files matching `src/*.ts`, `lib/*.ts`.\n\nBody\n"
    );
  });

  it("opens a rule that applies everywhere with its body alone", () => {
    expect(applyPlan(scopeStated(plan("---\ndescription: x\n---\nBody\n"), [])).content).toBe(
      "Body\n"
    );
  });
});
