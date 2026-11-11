import { describe, expect, it } from "vitest";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { type InstallKind, installPathOf } from "../../../testing/profiles.js";

describe("opencode profile", () => {
  it.each<[InstallKind, string, string]>([
    ["skills", "my-skill/SKILL.md", ".opencode/skills/my-skill/SKILL.md"],
    ["agents", "code-reviewer.md", ".opencode/agents/code-reviewer.md"],
    ["agents", "alexia.opencode.md", ".opencode/agents/alexia.md"],
    ["rules", "01-standards/naming.md", ".opencode/rules/01-standards/naming.md"],
    ["commands", "04_code/implement.md", ".opencode/commands/aidd/04/implement.md"],
    ["commands", "implement.md", ".opencode/commands/aidd/implement.md"],
  ])("installs %s file %s at %s", (kind, built, path) => {
    expect(installPathOf(opencode, kind, built)).toBe(path);
  });

  it("preserves every frontmatter field of a skill", () => {
    const fm = { name: "my-skill", description: "A skill" };
    expect(opencode.capabilities.skills.convertFrontmatter(fm)).toEqual(fm);
  });
});
