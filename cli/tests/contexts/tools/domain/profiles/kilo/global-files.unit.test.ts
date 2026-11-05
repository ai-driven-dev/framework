import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import { globalFilesOf } from "../../../../../../src/contexts/tools/domain/registry.js";

const AIDD_DEV = { name: "aidd-dev", agents: new Set(["reviewer"]) };

describe("the kilo profile's machine-scope files", () => {
  const machine = globalFilesOf("kilo");

  it("land in ~/.config/kilo under the home directory", () => {
    expect(machine?.dir("/home/me")).toBe(join("/home/me", ".config/kilo"));
  });

  it.each([
    [".kilo/skills/aidd-dev/01-plan/SKILL.md", "skills/aidd-dev/01-plan/SKILL.md"],
    [".kilo/agents/aidd-dev-reviewer.md", "agents/aidd-dev-reviewer.md"],
  ])("keep the plugin's own %s as %s", (built, path) => {
    expect(machine?.map(built, AIDD_DEV)).toBe(path);
  });

  it.each([
    ".kilo/skills/aidd-pm/01-epic/SKILL.md",
    ".kilo/agents/aidd-dev-executor.md",
    ".kilo/commands/aidd-dev-plan.md",
    ".opencode/skills/aidd-dev/01-plan/SKILL.md",
  ])("leave %s out", (built) => {
    expect(machine?.map(built, AIDD_DEV)).toBeNull();
  });
});
