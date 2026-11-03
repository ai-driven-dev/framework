import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { opencodeMachineFilePath } from "../../../../../../src/contexts/tools/domain/profiles/opencode/opencode-paths.js";
import { machineFilesOf } from "../../../../../../src/contexts/tools/domain/registry.js";

const AIDD_DEV = { name: "aidd-dev", agents: new Set(["reviewer"]) };

describe("opencodeMachineFilePath — what a machine-scope install copies into OpenCode's config dir", () => {
  it.each([
    [".opencode/skills/aidd-dev/01-plan/SKILL.md", "skills/aidd-dev/01-plan/SKILL.md"],
    [
      ".opencode/skills/aidd-dev/01-plan/actions/01-read.md",
      "skills/aidd-dev/01-plan/actions/01-read.md",
    ],
    [".opencode/agents/aidd-dev-reviewer.md", "agents/aidd-dev-reviewer.md"],
  ])("keeps the plugin's own %s as %s", (built, machine) => {
    expect(opencodeMachineFilePath(built, AIDD_DEV)).toBe(machine);
  });

  it.each([
    ".opencode/skills/aidd-pm/01-epic/SKILL.md",
    ".opencode/agents/aidd-pm-reviewer.md",
    ".opencode/commands/aidd-dev-plan.md",
    ".opencode/plugin/aidd-dev-hooks.js",
    ".opencode/agents/aidd-dev-reviewer.txt",
    ".opencode/agents/aidd-dev-executor.md",
    ".opencode/agents/aidd-dev-tools-reviewer.md",
    "skills/aidd-dev/01-plan/SKILL.md",
  ])(
    "leaves %s out: another plugin's, an agent it does not ship, or not loaded machine-wide",
    (built) => {
      expect(opencodeMachineFilePath(built, AIDD_DEV)).toBeNull();
    }
  );
});

describe("the opencode profile's machine-scope directory", () => {
  it("is ~/.config/opencode under the home directory", () => {
    expect(machineFilesOf("opencode")?.dir("/home/me")).toBe(join("/home/me", ".config/opencode"));
  });
});
