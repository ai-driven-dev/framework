import { describe, expect, it } from "vitest";
import { PROFILE_SECTION_KEYS } from "../../../../../../src/contexts/tools/domain/profile.js";
import { mergeAntigravityHooks } from "../../../../../../src/contexts/tools/domain/profiles/antigravity/antigravity-hooks.js";
import { antigravity } from "../../../../../../src/contexts/tools/domain/profiles/antigravity/profile.js";
import { flatOf } from "../../../testing/plugin-mode.js";
import { installPathOf } from "../../../testing/profiles.js";

describe("antigravity", () => {
  it("is named for the person reading it and declares a flat build only", () => {
    expect(antigravity.displayName).toBe("Antigravity CLI");
    expect(antigravity.directory).toBe(".agents/");
    expect(antigravity.buildContracts?.flat).toBeDefined();
    expect(antigravity.buildContracts?.marketplace).toBeUndefined();
    expect([
      antigravity.distributionPaths("manifest"),
      antigravity.distributionPaths("marketplace"),
    ]).toStrictEqual([[], []]);
  });

  it.each<[string, string]>([
    ["01-plan/SKILL.antigravity.md", ".agents/skills/aidd-01-plan/SKILL.md"],
    ["plan.antigravity.md", ".agents/skills/aidd-plan/SKILL.md"],
    ["plan.md", ".agents/skills/aidd-plan/SKILL.md"],
  ])("installs skill file %s at %s", (built, path) => {
    expect(installPathOf(antigravity, "skills", built)).toBe(path);
  });

  it("accepts the skills it installed and no other host's", () => {
    expect(antigravity.section("skills").accepts(".agents/skills/aidd-01-plan/SKILL.md")).toBe(
      true
    );
    expect(antigravity.section("skills").accepts(".kilo/skills/x/SKILL.md")).toBe(false);
  });

  it("is a flat host merging plugin hooks into .agents/hooks.json, scripts under .agents/hooks/", () => {
    const plugins = flatOf(antigravity.section("plugins"));
    expect({
      mode: plugins.kind,
      flatLayout: plugins.flatLayout(),
      acceptsHooks: plugins.hooksAcceptance().accepts,
      deliversHooksToProject: plugins.deliversHooksToProject(),
      projectHooksRelativePath: plugins.projectHooksDelivery()?.relativePath,
    }).toMatchObject({
      mode: "flat",
      flatLayout: {
        namespacePrefix: "aidd-",
        skillLayout: "single-level",
        hooksDir: ".agents/hooks/",
      },
      acceptsHooks: true,
      deliversHooksToProject: true,
      projectHooksRelativePath: ".agents/hooks.json",
    });
    expect(antigravity.section("plugins").projectHooksDelivery()?.format.merge).toBe(
      mergeAntigravityHooks
    );
    expect(PROFILE_SECTION_KEYS.filter((key) => antigravity.section(key) !== null).sort()).toEqual([
      "plugins",
      "skills",
    ]);
  });
});
