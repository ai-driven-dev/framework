import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import {
  expectClaudeStyleCatalog,
  pluginTreeShapeOf,
  rulesRows,
  SHIPPED_AS_IS,
  WRITES_NOTHING,
} from "../../../testing/profile-tables.js";
import { type InstallKind, installPathOf } from "../../../testing/profiles.js";

describe("claude profile", () => {
  it.each<[InstallKind, string, string]>([
    ["skills", "commit.claude.md", ".claude/skills/commit.md"],
    ["commands", "04_code/implement.md", ".claude/commands/aidd/04/implement.md"],
    [
      "commands",
      "02_context/create_user_stories.md",
      ".claude/commands/aidd/02/create_user_stories.md",
    ],
    ["commands", "4/implement.md", ".claude/commands/aidd/4/implement.md"],
    ["commands", "01-notes.md", ".claude/commands/01-notes.md"],
    ["commands", "v04/notes.md", ".claude/commands/v04/notes.md"],
  ])("installs %s file %s at %s", (kind, built, path) => {
    expect(installPathOf(claude, kind, built)).toBe(path);
  });
});

describe("claude build and conversion tables", () => {
  it("ships the plugin tree as it is", () => {
    expect(pluginTreeShapeOf(claude)).toStrictEqual(SHIPPED_AS_IS);
  });

  it("writes its catalog and entries in Claude's marketplace format", async () => {
    await expectClaudeStyleCatalog(claude, ".claude-plugin");
  });

  it.each(
    rulesRows({
      ...WRITES_NOTHING,
      "a paths list": { paths: ["a", "b"] },
      "globs that apply on request": { paths: ["a"] },
      "paths beside a description": { paths: ["a"] },
      "a description that opts out of always-apply": { description: "d" },
    })
  )("converts %s", (_case, frontmatter, expected) => {
    expect(claude.section("rules").convertFrontmatter(frontmatter)).toStrictEqual(expected);
  });
});
