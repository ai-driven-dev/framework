import { describe, expect, it } from "vitest";
import { stripCodexSkillFrontmatter } from "../../../../../../src/contexts/tools/domain/profiles/codex/build.js";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { serializeFrontmatter } from "../../../../../../src/kernel/markdown.js";

describe("codex skills", () => {
  describe("capabilities.skills.buildInstallPath()", () => {
    it("builds path under .agents/skills/aidd-{name}/SKILL.md", () => {
      const path = codex.capabilities.skills.buildInstallPath("my-skill/SKILL.md");
      expect(path).toBe(".agents/skills/aidd-my-skill/SKILL.md");
    });

    it("strips .codex.md tool suffix", () => {
      const path = codex.capabilities.skills.buildInstallPath("my-skill.codex.md");
      expect(path).toBe(".agents/skills/aidd-my-skill/SKILL.md");
    });

    it("strips plain .md suffix from skill name", () => {
      const path = codex.capabilities.skills.buildInstallPath("my-skill.md");
      expect(path).toBe(".agents/skills/aidd-my-skill/SKILL.md");
    });

    it("keeps a skill name that carries no extension at all", () => {
      const path = codex.capabilities.skills.buildInstallPath("my-skill");
      expect(path).toBe(".agents/skills/aidd-my-skill/SKILL.md");
    });

    it("keeps a skill folder's name whole, even one ending in .md", () => {
      const path = codex.capabilities.skills.buildInstallPath("notes.md/SKILL.md");
      expect(path).toBe(".agents/skills/aidd-notes.md/SKILL.md");
    });
  });
});

/**
 * Codex is the only target that re-serialises skill frontmatter instead of passing the file
 * through, so these pin the transform itself rather than the golden that recorded its output.
 */
describe("a skill's frontmatter, rewritten for Codex", () => {
  const rebuild = (fm: Record<string, unknown>) =>
    serializeFrontmatter(stripCodexSkillFrontmatter(fm), "body\n");

  it("keeps the three fields Codex reads", () => {
    expect(
      stripCodexSkillFrontmatter({
        name: "aidd-dev:01:plan",
        description: "Plan things",
        allowed_tools: ["Read"],
      })
    ).toEqual({ name: "aidd-dev:01:plan", description: "Plan things", allowed_tools: ["Read"] });
  });

  it("drops the fields it does not, rather than passing them through", () => {
    // `model` is the one the framework ships and Codex has no use for.
    expect(stripCodexSkillFrontmatter({ name: "n", description: "d", model: "opus" })).toEqual({
      name: "n",
      description: "d",
    });
  });

  it("omits a field the source never set", () => {
    expect(stripCodexSkillFrontmatter({ description: "d" })).toEqual({ description: "d" });
  });

  it("writes no description key for a skill that has none", () => {
    expect(stripCodexSkillFrontmatter({ name: "n" })).toStrictEqual({ name: "n" });
  });

  it("quotes a value whose colon would otherwise make the frontmatter unreadable", () => {
    // Not cosmetic: a description containing ": " makes `js-yaml` refuse the source with "bad
    // indentation of a mapping entry". Re-serialising with quotes is what makes it parse.
    expect(rebuild({ name: "aidd-context:03:context-generate", description: "Do a: thing" })).toBe(
      "---\nname: 'aidd-context:03:context-generate'\ndescription: 'Do a: thing'\n---\nbody\n"
    );
  });

  it("escapes a quote in the value rather than closing the string early", () => {
    expect(rebuild({ description: "it's here" })).toBe(
      "---\ndescription: 'it''s here'\n---\nbody\n"
    );
  });
});
