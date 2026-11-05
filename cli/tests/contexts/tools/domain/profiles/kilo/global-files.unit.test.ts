import { describe, expect, it } from "vitest";
import { kiloGlobalFilePath } from "../../../../../../src/contexts/tools/domain/profiles/kilo/kilo-paths.js";

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
    expect(kiloGlobalFilePath(".kilo/hooks/aidd-maintenance/other.cjs", maintenance)).toBeNull();
    expect(kiloGlobalFilePath(".kilo/skills/aidd-dev/01-plan/SKILL.md", other)).toBe(
      "skills/aidd-dev/01-plan/SKILL.md"
    );
  });
});
