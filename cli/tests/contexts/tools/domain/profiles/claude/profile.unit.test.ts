import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { type InstallKind, installPathOf } from "../../../testing/profiles.js";

describe("claude profile", () => {
  it("lives in .claude/ and writes its one config file to .claude/settings.json", () => {
    expect(claude.directory).toBe(".claude/");
    expect(claude.configOutputPaths).toStrictEqual({ "settings.json": ".claude/settings.json" });
  });

  it.each<[InstallKind, string, string]>([
    ["skills", "commit.claude.md", ".claude/skills/commit.md"],
    ["agents", "code-reviewer.md", ".claude/agents/code-reviewer.md"],
    ["rules", "01-standards/naming.md", ".claude/rules/01-standards/naming.md"],
    ["commands", "04_code/implement.md", ".claude/commands/aidd/04/implement.md"],
    [
      "commands",
      "02_context/create_user_stories.md",
      ".claude/commands/aidd/02/create_user_stories.md",
    ],
  ])("installs %s file %s at %s", (kind, built, path) => {
    expect(installPathOf(claude, kind, built)).toBe(path);
  });
});
