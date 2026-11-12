import { describe, expect, it } from "vitest";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { rulesRows, WRITES_NOTHING } from "../../../testing/profile-tables.js";
import { type InstallKind, installPathOf } from "../../../testing/profiles.js";

describe("opencode profile", () => {
  it.each<[InstallKind, string, string]>([
    ["agents", "alexia.opencode.md", ".opencode/agents/alexia.md"],
    ["commands", "04_code/implement.md", ".opencode/commands/aidd/04/implement.md"],
  ])("installs %s file %s at %s", (kind, built, path) => {
    expect(installPathOf(opencode, kind, built)).toBe(path);
  });

  it("preserves every frontmatter field of a skill", () => {
    const fm = { name: "my-skill", description: "A skill" };
    expect(opencode.section("skills").convertFrontmatter(fm)).toEqual(fm);
  });
});

describe("opencode build and conversion tables", () => {
  it.each(
    rulesRows({
      ...WRITES_NOTHING,
      "a paths list": {},
      "globs that apply on request": { description: "d" },
      "paths beside a description": { description: "d" },
      "a description that opts out of always-apply": { description: "d" },
    })
  )("converts %s", (_case, frontmatter, expected) => {
    expect(opencode.section("rules").convertFrontmatter(frontmatter)).toStrictEqual(expected);
  });
});
