import { describe, expect, it } from "vitest";
import { claude } from "../../../src/composition/tool-profiles/claude.js";
import {
  expectClaudeStyleCatalog,
  pluginTreeShapeOf,
  rulesRows,
  SHIPPED_AS_IS,
  WRITES_NOTHING,
} from "../../contexts/tools/testing/profile-tables.builder.js";

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
