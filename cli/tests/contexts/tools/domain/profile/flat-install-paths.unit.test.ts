import { describe, expect, it } from "vitest";
import { antigravity } from "../../../../../src/contexts/tools/domain/profiles/antigravity/antigravity.profile.js";
import { opencode } from "../../../../../src/contexts/tools/domain/profiles/opencode/opencode.profile.js";

describe("where a flat plugin's files are installed", () => {
  it("nests a skill under its plugin when the tool scans nested folders", () => {
    expect(opencode.flatInstallPath("skills", "aidd", "plan/SKILL.md")).toBe(
      ".opencode/skills/aidd/plan/SKILL.md"
    );
  });

  it("prefixes a skill with its plugin when the tool scans a single level", () => {
    expect(antigravity.flatInstallPath("skills", "aidd", "plan/SKILL.md")).toBe(
      ".agents/skills/aidd-plan/SKILL.md"
    );
  });

  it("places an agent as a build does, and nests rules and commands under their plugin", () => {
    expect([
      antigravity.flatInstallPath("agents", "aidd", "a.md"),
      antigravity.flatInstallPath("rules", "aidd", "r.md"),
      antigravity.flatInstallPath("commands", "aidd", "c.md"),
    ]).toStrictEqual([
      ".agents/agents/aidd-a/agent.md",
      ".agents/rules/aidd/r.md",
      ".agents/commands/aidd/c.md",
    ]);
  });

  it.each([
    ["opencode", opencode],
    ["antigravity", antigravity],
  ])("%s owns what it places for a skill and an agent, and no other plugin's", (_name, tool) => {
    const placed = [
      tool.flatInstallPath("skills", "aidd", "plan/SKILL.md"),
      tool.flatInstallPath("agents", "aidd", "a.md"),
    ];
    expect(placed.map((path) => tool.ownsFlatPath(path, "aidd"))).toStrictEqual([true, true]);
    expect(placed.map((path) => tool.ownsFlatPath(path, "aidd-extra"))).toStrictEqual([
      false,
      false,
    ]);
  });
});

describe("whether a built path belongs to a flat plugin", () => {
  it("owns a nested skill under the plugin's own folder and no sibling plugin's", () => {
    expect([
      opencode.ownsFlatPath(".opencode/skills/aidd/plan/SKILL.md", "aidd"),
      opencode.ownsFlatPath(".opencode/skills/aidd-extra/plan/SKILL.md", "aidd"),
    ]).toStrictEqual([true, false]);
  });

  it("owns a single-level skill by its plugin prefix and not a nested folder", () => {
    expect([
      antigravity.ownsFlatPath(".agents/skills/aidd-plan/SKILL.md", "aidd"),
      antigravity.ownsFlatPath(".agents/skills/aidd/plan/SKILL.md", "aidd"),
    ]).toStrictEqual([true, false]);
  });

  it("owns an agent by its plugin prefix", () => {
    expect([
      antigravity.ownsFlatPath(".agents/agents/aidd-a/agent.md", "aidd"),
      antigravity.ownsFlatPath(".agents/agents/other-a/agent.md", "aidd"),
    ]).toStrictEqual([true, false]);
  });

  it("owns nothing outside the tool's directory or above a section's file", () => {
    expect([
      antigravity.ownsFlatPath(".kilo/skills/aidd-plan/SKILL.md", "aidd"),
      antigravity.ownsFlatPath(".agents/skills", "aidd"),
    ]).toStrictEqual([false, false]);
  });
});
