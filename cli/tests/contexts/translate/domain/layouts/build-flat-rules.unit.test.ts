import { describe, expect, it } from "vitest";
import { kilo as kiloTool } from "../../../../../src/composition/tool-profiles/kilo.js";
import { flatRules } from "../../../../../src/contexts/translate/domain/layouts/build-flat-rules.js";
import { rulesIn } from "../../../../../src/shared/domain/materialization/artifact-path.js";
import { flatArtifactLayout } from "../../../../../src/shared/domain/materialization/flat-paths.js";
import { translateBuildLayout } from "../../../../shared/testing/build-files.builder.js";
import { present } from "../../../../shared/testing/present.builder.js";
import { aCanon } from "../../testing/canon-distribution.builder.js";
import { translator } from "../../testing/engine-kit.builder.js";
import { kilo } from "../../testing/registered-profiles.builder.js";

const UNSCOPED = '---\ndescription: "Naming"\n---\n# Naming\n';
const SCOPED =
  '---\ndescription: "TypeScript"\npaths:\n  - "**/*.ts"\n  - "**/*.tsx"\n---\n# TypeScript\n';

const RULES = {
  "rules/01-standards/1-naming.md": UNSCOPED,
  "rules/01-standards/2-ts.md": SCOPED,
};

function built(files: Record<string, string>): Record<string, string> {
  const written = translateBuildLayout(
    aCanon("aidd-craft", files),
    present(kiloTool.buildContracts.flat)(),
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
