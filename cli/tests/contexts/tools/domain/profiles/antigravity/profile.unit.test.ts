import { describe, expect, it } from "vitest";
import { antigravityProjectHooksFormat } from "../../../../../../src/contexts/tools/domain/profiles/antigravity/antigravity-hooks.js";
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

  it("is a flat host merging plugin hooks into .agents/hooks.json, scripts under .agents/hooks/", () => {
    expect(antigravity.capabilities.plugins).toMatchObject({
      mode: "flat",
      flatNamespacePrefix: "aidd-",
      flatSkillLayout: "single-level",
      acceptsHooks: true,
      flatHooksDir: ".agents/hooks/",
      hooksDestination: "project",
      projectHooksRelativePath: ".agents/hooks.json",
      projectHooksFormat: antigravityProjectHooksFormat,
    });
    expect(Object.keys(antigravity.capabilities).sort()).toEqual(["plugins", "skills"]);
  });

  it("declares telemetry unsupported with a reason", () => {
    expect(antigravity.telemetryLocalRead).toEqual({
      kind: "unsupported",
      reason: "Antigravity CLI telemetry is not yet supported by AIDD.",
    });
    expect(antigravity.telemetryTaskAttributable).toBe(false);
  });
});
