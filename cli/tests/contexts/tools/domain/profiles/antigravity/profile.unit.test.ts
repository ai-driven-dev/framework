import { describe, expect, it } from "vitest";
import { antigravity } from "../../../../../../src/contexts/tools/domain/profiles/antigravity/profile.js";

describe("antigravity", () => {
  it("is named for the person reading it and declares a flat build only", () => {
    expect(antigravity.displayName).toBe("Antigravity CLI");
    expect(antigravity.directory).toBe(".agents/");
    expect(antigravity.buildContracts?.flat).toBeDefined();
    expect(antigravity.buildContracts?.marketplace).toBeUndefined();
    expect(antigravity.distributionProbes).toBeUndefined();
  });

  it("installs skills under .agents/skills with the aidd- namespace", () => {
    expect(antigravity.capabilities.skills.buildInstallPath("01-plan/SKILL.antigravity.md")).toBe(
      ".agents/skills/aidd-01-plan/SKILL.md"
    );
    expect(antigravity.capabilities.skills.accepts(".agents/skills/aidd-01-plan/SKILL.md")).toBe(
      true
    );
    expect(antigravity.capabilities.skills.accepts(".kilo/skills/x/SKILL.md")).toBe(false);
  });

  it.each([
    ["plan.antigravity.md", ".agents/skills/aidd-plan/SKILL.md"],
    ["plan.md", ".agents/skills/aidd-plan/SKILL.md"],
  ])("names a skill from the flat file %s, dropping its suffix", (fileName, expected) => {
    expect(antigravity.capabilities.skills.buildInstallPath(fileName)).toBe(expected);
  });

  it("is a flat host that accepts no hooks until the hooks phase", () => {
    expect(antigravity.capabilities.plugins).toMatchObject({
      mode: "flat",
      flatNamespacePrefix: "aidd-",
      flatSkillLayout: "single-level",
      acceptsHooks: false,
    });
    expect(antigravity.capabilities.plugins.hooksUnsupportedReason).toBe(
      "Antigravity CLI hooks are not wired yet."
    );
    expect(Object.keys(antigravity.capabilities).sort()).toEqual(["plugins", "skills"]);
  });
});
