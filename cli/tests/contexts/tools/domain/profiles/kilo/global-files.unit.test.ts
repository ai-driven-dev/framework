import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import { kiloGlobalFilePath } from "../../../../../../src/contexts/tools/domain/profiles/kilo/hooks.js";
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

const maintenance = { name: "aidd-maintenance", agents: new Set<string>() };
const other = { name: "aidd-dev", agents: new Set(["reviewer"]) };

describe("Kilo machine files", () => {
  it.each([
    [".kilo/hooks/aidd-maintenance/session-start.cjs", "hooks/aidd-maintenance/session-start.cjs"],
    [".kilo/hooks/aidd-maintenance/kilo-tui.js", "hooks/aidd-maintenance/kilo-tui.js"],
    [".kilo/plugin/aidd-maintenance-hooks.js", "plugin/aidd-maintenance-hooks.js"],
  ])("includes maintenance startup file %s only for its owner", (path, expected) => {
    expect(kiloGlobalFilePath(path, maintenance)).toBe(expected);
    expect(kiloGlobalFilePath(path, other)).toBeNull();
  });

  it("keeps all other hooks project-scoped", () => {
    expect(kiloGlobalFilePath(".kilo/plugin/aidd-dev-hooks.js", other)).toBeNull();
    expect(kiloGlobalFilePath(".kilo/hooks/aidd-dev/session-start.cjs", other)).toBeNull();
    expect(kiloGlobalFilePath(".kilo/hooks/aidd-maintenance/lib/versions.cjs", maintenance)).toBe(
      "hooks/aidd-maintenance/lib/versions.cjs"
    );
    expect(kiloGlobalFilePath(".kilo/skills/aidd-dev/01-plan/SKILL.md", other)).toBe(
      "skills/aidd-dev/01-plan/SKILL.md"
    );
  });
});
