import { describe, expect, it } from "vitest";
import { kimi } from "../../../../../../src/contexts/tools/domain/profiles/kimi/profile.js";

describe("kimi", () => {
  it("is named for the person reading it and declares a flat build only", () => {
    expect(kimi.displayName).toBe("Kimi Code CLI");
    expect(kimi.directory).toBe(".kimi-code/");
    expect(kimi.buildContracts?.flat).toBeDefined();
    expect(kimi.buildContracts?.marketplace).toBeUndefined();
    expect(kimi.distributionProbes).toBeUndefined();
  });

  it("installs skills under its own .kimi-code/skills, never the shared .agents/", () => {
    expect(kimi.capabilities.skills.buildInstallPath("01-plan/SKILL.kimi.md")).toBe(
      ".kimi-code/skills/01-plan/SKILL.md"
    );
    expect(kimi.capabilities.skills.accepts(".kimi-code/skills/01-plan/SKILL.md")).toBe(true);
    expect(kimi.capabilities.skills.accepts(".agents/skills/01-plan/SKILL.md")).toBe(false);
  });

  it("keeps skill metadata as written", () => {
    const metadata = { name: "plan", description: "Plan work", license: "MIT" };
    expect(kimi.capabilities.skills.convertFrontmatter(metadata)).toEqual(metadata);
  });

  it("is a flat host with one-level skills that receives no hooks yet", () => {
    expect(kimi.capabilities.plugins).toMatchObject({
      mode: "flat",
      flatNamespacePrefix: "aidd-",
      flatSkillLayout: "single-level",
      acceptsHooks: false,
      hooksUnsupportedReason: "Kimi Code CLI hooks are not wired yet.",
      flatHooksDir: null,
    });
    expect(Object.keys(kimi.capabilities).sort()).toEqual(["plugins", "skills"]);
  });
});
