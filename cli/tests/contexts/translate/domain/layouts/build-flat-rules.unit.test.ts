import { describe, expect, it } from "vitest";
import { antigravity as antigravityTool } from "../../../../../src/composition/tool-profiles/antigravity.js";
import { kilo as kiloTool } from "../../../../../src/composition/tool-profiles/kilo.js";
import { kiro as kiroTool } from "../../../../../src/composition/tool-profiles/kiro.js";
import { flatRules } from "../../../../../src/contexts/translate/domain/layouts/build-flat-rules.js";
import { rulesIn } from "../../../../../src/shared/domain/materialization/artifact-path.js";
import { flatArtifactLayout } from "../../../../../src/shared/domain/materialization/flat-paths.js";
import { translateBuildLayout } from "../../../../shared/testing/build-files.builder.js";
import { present } from "../../../../shared/testing/present.builder.js";
import { aCanon } from "../../testing/canon-distribution.builder.js";
import { translator } from "../../testing/engine-kit.builder.js";
import { kilo, kiro } from "../../testing/registered-profiles.builder.js";

const UNSCOPED = '---\ndescription: "Naming"\n---\n# Naming\n';
const SCOPED =
  '---\ndescription: "TypeScript"\npaths:\n  - "**/*.ts"\n  - "**/*.tsx"\n---\n# TypeScript\n';

const RULES = {
  "rules/01-standards/1-naming.md": UNSCOPED,
  "rules/01-standards/2-ts.md": SCOPED,
};

function built(
  files: Record<string, string>,
  tool: { buildContracts: typeof kiloTool.buildContracts } = kiloTool
): Record<string, string> {
  const written = translateBuildLayout(
    aCanon("aidd-craft", files),
    present(tool.buildContracts.flat)(),
    "flat"
  );
  return Object.fromEntries(written.map((file) => [file.relativePath, file.content]));
}

describe("the rules of a flat build for a tool that reads no frontmatter", () => {
  it("lands every rule at the top of the rules folder, named by its plugin and its group", () => {
    expect(Object.keys(built(RULES))).toEqual([
      ".kilo/rules/aidd-craft-01-standards-1-naming.md",
      ".kilo/rules/aidd-craft-01-standards-2-ts.md",
    ]);
  });

  it("keeps a path-scoped rule's scope as the first line of its body, with no frontmatter", () => {
    const files = built(RULES);

    expect(files[".kilo/rules/aidd-craft-01-standards-2-ts.md"]).toBe(
      "Applies to files matching `**/*.ts`, `**/*.tsx`.\n\n# TypeScript\n"
    );
    expect(files[".kilo/rules/aidd-craft-01-standards-1-naming.md"]).toBe("# Naming\n");
  });

  it("writes the same bytes at the same path as a local install of the same rules", () => {
    const canon = aCanon("aidd-craft", RULES);

    const installed = Object.fromEntries(
      translator.translate(canon, kilo).map((file) => [file.relativePath, file.content])
    );

    expect(built(RULES)).toEqual(installed);
  });
});

describe("the rules of a flat build for a tool that keeps each plugin's rules under its own folder", () => {
  const nested = flatArtifactLayout(".tool/", { skills: "nested", agent: { ext: ".md" } });

  it("carries a rule as shipped, its scope in its frontmatter", () => {
    const [plan] = flatRules(aCanon("aidd-craft", { "rules/01-standards/2-ts.md": SCOPED }), {
      supported: true,
      source: { kind: "filteredTree", srcDir: "rules", inputExt: ".md" },
      placement: rulesIn(nested),
    });

    expect([plan.path, plan.shape]).toEqual([
      ".tool/rules/aidd-craft/01-standards/2-ts.md",
      undefined,
    ]);
  });
});

describe("the rules of a flat build for a tool that reads its own scope frontmatter", () => {
  it.each([
    {
      name: "kiro",
      tool: kiroTool,
      profile: kiro,
      scoped:
        '---\ninclusion: "fileMatch"\nfileMatchPattern:\n  - "**/*.ts"\n  - "**/*.tsx"\n---\n# TypeScript\n',
      unscoped: '---\ninclusion: "always"\n---\n# Naming\n',
      dir: ".kiro/steering/",
    },
  ])(
    "$name lands each rule at the top of its folder with its own frontmatter, as an install does",
    ({ tool, profile, scoped, unscoped, dir }) => {
      const files = built(RULES, tool);

      expect(files).toEqual({
        [`${dir}aidd-craft-01-standards-1-naming.md`]: unscoped,
        [`${dir}aidd-craft-01-standards-2-ts.md`]: scoped,
      });
      const installed = Object.fromEntries(
        translator
          .translate(aCanon("aidd-craft", RULES), profile)
          .map((f) => [f.relativePath, f.content])
      );
      expect(files).toEqual(installed);
    }
  );
});

describe("the rules of a flat build for antigravity", () => {
  it("lands each rule at the top of .agents/rules/ with its own frontmatter", () => {
    expect(built(RULES, antigravityTool)).toEqual({
      ".agents/rules/aidd-craft-01-standards-1-naming.md":
        '---\ndescription: "Naming"\ntrigger: "always_on"\n---\n# Naming\n',
      ".agents/rules/aidd-craft-01-standards-2-ts.md":
        '---\ndescription: "TypeScript"\ntrigger: "glob"\nglobs: "**/*.ts, **/*.tsx"\n---\n# TypeScript\n',
    });
  });
});
