import { describe, expect, it } from "vitest";
import { applyPlan } from "../../../../../src/contexts/translate/domain/rules/component-pipeline.js";
import {
  ruleFilePlan,
  ruleScope,
} from "../../../../../src/contexts/translate/domain/rules/rule-scope.js";
import { flatArtifactLayout } from "../../../../../src/shared/domain/materialization/flat-paths.js";

describe("the scope a rule declares", () => {
  it("reads the globs of its paths, none when it declares no list", () => {
    expect([
      ruleScope('---\npaths:\n  - "**/*.ts"\n  - "**/*.tsx"\n---\n# T\n'),
      ruleScope("---\ndescription: x\n---\n# T\n"),
      ruleScope("---\npaths: src/*.ts\n---\n# T\n"),
      ruleScope("# T\n"),
    ]).toStrictEqual([["**/*.ts", "**/*.tsx"], [], [], []]);
  });

  it("reads the globs of a rule scoped by `globs`", () => {
    expect(ruleScope('---\nglobs:\n  - "**/*.ts"\n---\n# T\n')).toStrictEqual(["**/*.ts"]);
  });
});

describe("stating a rule's scope in its body", () => {
  const noFrontmatter = flatArtifactLayout(".tool/", {
    skills: "nested",
    agent: { ext: ".md" },
    rules: "top-level-no-frontmatter",
  });
  const placed = (content: string) =>
    applyPlan(
      ruleFilePlan({ source: "rules/a.md", path: "out/a.md", content }, content, {
        layout: noFrontmatter,
      })
    ).content;

  it("drops the frontmatter and opens the body with the globs it applied to", () => {
    expect(placed('---\ndescription: x\npaths: ["src/*.ts", "lib/*.ts"]\n---\nBody\n')).toBe(
      "Applies to files matching `src/*.ts`, `lib/*.ts`.\n\nBody\n"
    );
  });

  it("opens a rule that applies everywhere with its body alone", () => {
    expect(placed("---\ndescription: x\n---\nBody\n")).toBe("Body\n");
  });
});

describe("a rule's plan for a tool that keeps rule frontmatter", () => {
  it("carries the rule as shipped", () => {
    const nested = flatArtifactLayout(".tool/", { skills: "nested", agent: { ext: ".md" } });
    const base = { source: "rules/a.md", path: "out/a.md", content: "---\npaths: [a]\n---\nB\n" };

    expect(ruleFilePlan(base, base.content, { layout: nested })).toBe(base);
  });
});

describe("a rule's plan for a tool whose contract writes rule markdown", () => {
  const layout = (rules: "top-level" | "top-level-no-frontmatter") =>
    flatArtifactLayout(".tool/", { skills: "nested", agent: { ext: ".md" }, rules });
  const rule = "---\ndescription: x\npaths:\n  - a\n---\nBody\n";
  const markdown = { frontmatter: (fm: Record<string, unknown>) => ({ scope: fm.paths }) };
  const placed = (rules: "top-level" | "top-level-no-frontmatter") =>
    applyPlan(
      ruleFilePlan({ source: "rules/a.md", path: "out/a.md", content: rule }, rule, {
        layout: layout(rules),
        markdown,
      })
    ).content;

  it("replaces the frontmatter with what the contract writes for it, the body kept", () => {
    expect(placed("top-level")).toBe("---\nscope:\n  - a\n---\nBody\n");
  });

  it("leaves a tool that reads no frontmatter to its body-stated scope", () => {
    expect(placed("top-level-no-frontmatter")).toBe("Applies to files matching `a`.\n\nBody\n");
  });
});
