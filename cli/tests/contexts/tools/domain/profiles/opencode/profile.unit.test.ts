import { describe, expect, it } from "vitest";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { ToolCatalog } from "../../../../../../src/contexts/tools/domain/registry.js";
import { distributionProbesOf } from "../../../../../../src/contexts/translate/domain/plugin-format.js";
import { flatPathsOf, rulesRows, WRITES_NOTHING } from "../../../testing/profile-tables.js";
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
    expect(opencode.section("skills").convertFrontmatter(fm)).toEqual(fm);
  });
});

describe("opencode build and conversion tables", () => {
  it("places a flat skill and agent under its plugin's name", () => {
    expect(flatPathsOf(opencode)).toStrictEqual({
      skill: ".opencode/skills/aidd-dev/01-plan/SKILL.md",
      renamesSkill: true,
      agent: ".opencode/agents/aidd-dev-planner.md",
      innerMdAgent: ".opencode/agents/aidd-dev-notes.md-helper.md",
    });
  });

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

describe("opencode as the registry answers for it", () => {
  it("builds flat, and probes a marketplace although it builds none natively", () => {
    expect(new ToolCatalog([opencode]).frameworkBuildModeFor("opencode")).toBe("flat");
    expect(
      distributionProbesOf(new Map([[opencode.toolId, opencode]]), "marketplace").map(
        (probe) => probe.format
      )
    ).toEqual(["opencode"]);
  });

  it("installs its rules into .opencode/rules/ as markdown", () => {
    expect(opencode.section("rules").installedLocation()).toEqual({
      directory: ".opencode/rules/",
      extension: ".md",
    });
  });
});
