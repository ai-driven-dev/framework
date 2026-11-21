import { describe, expect, it } from "vitest";
import { toInstalledRule } from "../../../../src/contexts/installation/domain/installed-rule.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";

describe("toInstalledRule - one installed file, read as a rule", () => {
  it("names the rule from its own file, never from the frontmatter", () => {
    const rule = toInstalledRule({
      tool: TOOL.claude,
      path: ".claude/rules/01-standards/1-naming.md",
      extension: ".md",
      content: "---\n---\n",
    });

    expect(rule.name).toBe("1-naming");
    expect(rule.path).toBe(".claude/rules/01-standards/1-naming.md");
    expect(rule.tool).toBe("claude");
  });

  // Copilot's installed extension is several segments long, so trimming at the last dot
  // would leave `.instructions` glued to every Copilot rule's name.
  it("trims the whole installed extension, however many segments it carries", () => {
    const rule = toInstalledRule({
      tool: TOOL.copilot,
      path: ".github/instructions/02-naming.instructions.md",
      extension: ".instructions.md",
      content: "",
    });

    expect(rule.name).toBe("02-naming");
  });

  it("reads the description a rule states, and an empty one where it states none", () => {
    const described = toInstalledRule({
      tool: TOOL.cursor,
      path: ".cursor/rules/a.mdc",
      extension: ".mdc",
      content: "---\ndescription: Names files\n---\n",
    });
    const bare = toInstalledRule({
      tool: TOOL.cursor,
      path: ".cursor/rules/b.mdc",
      extension: ".mdc",
      content: "# no frontmatter\n",
    });

    expect(described.description).toBe("Names files");
    expect(bare.description).toBe("");
  });

  /** Each tool names the scope field differently - `paths`, `globs`, `applyTo` - and a file
   * converted between tools can carry more than one, so they are merged rather than picked. */
  it("merges every spelling of the scope field into one list", () => {
    const rule = toInstalledRule({
      tool: TOOL.cursor,
      path: ".cursor/rules/a.mdc",
      extension: ".mdc",
      content: '---\npaths:\n  - "src/**"\nglobs:\n  - "tests/**"\napplyTo: "docs/**"\n---\n',
    });

    expect(rule.paths).toEqual(["src/**", "tests/**", "docs/**"]);
  });

  // A rule that names no scope applies everywhere, which is a different statement from
  // "applies to an empty list of paths" - so the field is absent, never an empty array.
  it("states no scope at all for a rule that names none", () => {
    const rule = toInstalledRule({
      tool: TOOL.claude,
      path: ".claude/rules/a.md",
      extension: ".md",
      content: "---\n---\n",
    });

    expect(rule.paths).toBeUndefined();
  });

  it("splits a comma-joined scope, which is the form Cursor is generated with", () => {
    const rule = toInstalledRule({
      tool: TOOL.cursor,
      path: ".cursor/rules/a.mdc",
      extension: ".mdc",
      content: '---\nglobs: "src/**, tests/**"\n---\n',
    });

    expect(rule.paths).toEqual(["src/**", "tests/**"]);
  });

  it("drops the empty entries a stray or trailing comma leaves in a scope", () => {
    const rule = toInstalledRule({
      tool: TOOL.cursor,
      path: ".cursor/rules/a.mdc",
      extension: ".mdc",
      content: '---\nglobs: "src/**,, tests/**,"\n---\n',
    });

    expect(rule.paths).toStrictEqual(["src/**", "tests/**"]);
  });

  /** `SCOPE_FIELDS.flatMap` concatenates without deduplicating, so a glob carried under two
   * field names at once would come out twice in `InstalledRule.paths`. */
  it("states a glob carried under two field names only once", () => {
    const rule = toInstalledRule({
      tool: TOOL.cursor,
      path: ".cursor/rules/a.mdc",
      extension: ".mdc",
      content: '---\npaths:\n  - "src/**"\nglobs:\n  - "src/**"\n---\n',
    });

    expect(rule.paths).toEqual(["src/**"]);
  });
});
