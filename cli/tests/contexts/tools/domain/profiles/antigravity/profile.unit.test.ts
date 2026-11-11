import { describe, expect, it } from "vitest";
import { mergeAntigravityHooks } from "../../../../../../src/contexts/tools/domain/profiles/antigravity/antigravity-hooks.js";
import { antigravity } from "../../../../../../src/contexts/tools/domain/profiles/antigravity/profile.js";
import { installPathOf } from "../../../testing/profiles.js";

describe("antigravity", () => {
  it("is named for the person reading it and declares a flat build only", () => {
    expect(antigravity.displayName).toBe("Antigravity CLI");
    expect(antigravity.directory).toBe(".agents/");
    expect(antigravity.buildContracts?.flat).toBeDefined();
    expect(antigravity.buildContracts?.marketplace).toBeUndefined();
    expect(antigravity.distributionProbes).toBeUndefined();
  });

  it.each<[string, string]>([
    ["01-plan/SKILL.antigravity.md", ".agents/skills/aidd-01-plan/SKILL.md"],
    ["plan.antigravity.md", ".agents/skills/aidd-plan/SKILL.md"],
    ["plan.md", ".agents/skills/aidd-plan/SKILL.md"],
  ])("installs skill file %s at %s", (built, path) => {
    expect(installPathOf(antigravity, "skills", built)).toBe(path);
  });

  it("accepts the skills it installed and no other host's", () => {
    expect(antigravity.capabilities.skills.accepts(".agents/skills/aidd-01-plan/SKILL.md")).toBe(
      true
    );
    expect(antigravity.capabilities.skills.accepts(".kilo/skills/x/SKILL.md")).toBe(false);
  });

  it("is a flat host merging plugin hooks into .agents/hooks.json, scripts under .agents/hooks/", () => {
    expect(antigravity.capabilities.plugins).toMatchObject({
      mode: "flat",
      flatNamespacePrefix: "aidd-",
      flatSkillLayout: "single-level",
      acceptsHooks: true,
      flatHooksDir: ".agents/hooks/",
      hooksDestination: "project",
      projectHooksRelativePath: ".agents/hooks.json",
    });
    expect(antigravity.capabilities.plugins.projectHooksFormat?.merge).toBe(mergeAntigravityHooks);
    expect(Object.keys(antigravity.capabilities).sort()).toEqual(["plugins", "skills"]);
  });
});
