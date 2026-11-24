import { describe, expect, it } from "vitest";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { translator } from "../../testing/engine-kit.builder.js";
import { kilo, opencode } from "../../testing/registered-profiles.builder.js";

const SCOPED_AS_LIST =
  '---\ndescription: "TypeScript"\npaths:\n  - "**/*.ts"\n  - "**/*.tsx"\n---\n# TypeScript\n';

function distWithRules(scopedContent = SCOPED_AS_LIST): PluginDistribution {
  const unscoped = { relativePath: "rules/01-standards/1-naming.md", content: "# Naming\n" };
  const scoped = { relativePath: "rules/01-standards/2-ts.md", content: scopedContent };
  return new PluginDistribution({
    manifest: { name: parsePluginName("aidd-craft"), version: "1.0.0" },
    format: TOOL.claude,
    files: [unscoped, scoped],
    components: {
      commands: [],
      agents: [],
      rules: [unscoped, scoped],
      skills: [],
      hooks: [],
      mcp: [],
    },
  });
}

describe("a rule installed flat for a tool that reads no paths frontmatter", () => {
  it("writes an unscoped rule at the top level of the rules folder", () => {
    const paths = translator.translate(distWithRules(), kilo).map((f) => f.relativePath);

    expect(paths).toContain(".kilo/rules/aidd-craft-01-standards-1-naming.md");
  });

  it("writes a path-scoped rule there too, stating its scope as the first line of its body", () => {
    const result = translator.translateWithComponentPaths(distWithRules(), kilo);

    const written = result.files.find((f) => f.relativePath.endsWith("2-ts.md"));
    expect(written?.relativePath).toBe(".kilo/rules/aidd-craft-01-standards-2-ts.md");
    expect(written?.content).toBe(
      "Applies to files matching `**/*.ts`, `**/*.tsx`.\n\n# TypeScript\n"
    );
    expect(result.skipped).toEqual([]);
  });

  it("writes an unscoped rule without frontmatter, as the rule-generate skill does", () => {
    const unscoped = {
      relativePath: "rules/01-standards/1-naming.md",
      content: '---\ndescription: "Naming"\n---\n# Naming\n',
    };
    const base = distWithRules();
    const dist = new PluginDistribution({
      manifest: base.manifest,
      format: TOOL.claude,
      files: [unscoped],
      components: { ...base.components, rules: [unscoped] },
    });

    const written = translator
      .translate(dist, kilo)
      .find((f) => f.relativePath.endsWith("1-naming.md"));
    expect(written?.content).toBe("# Naming\n");
  });

  it("states a single path written as a string the same way", () => {
    const result = translator.translateWithComponentPaths(
      distWithRules('---\npaths: "**/*.ts"\n---\n# TypeScript\n'),
      kilo
    );

    const written = result.files.find((f) => f.relativePath.endsWith("2-ts.md"));
    expect(written?.content).toContain("Applies to files matching `**/*.ts`.\n\n# TypeScript\n");
  });

  it("leaves a tool that loads nested rules as it was", () => {
    const result = translator.translateWithComponentPaths(distWithRules(), opencode);

    expect(result.files.map((f) => f.relativePath)).toContain(
      ".opencode/rules/aidd-craft/01-standards/2-ts.md"
    );
    expect(result.skipped).toEqual([]);
  });
});
