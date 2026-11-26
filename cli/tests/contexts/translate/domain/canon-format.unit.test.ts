import { describe, expect, it } from "vitest";
import {
  OUT_OF_SCOPE_PLUGIN_SECTIONS,
  PLUGIN_AGENT_INPUT_EXT,
  PLUGIN_SKILL_ENTRY_FILE,
} from "../../../../src/contexts/translate/domain/canon-format.js";

describe("canon format", () => {
  it("writes agents and skill entries in markdown", () => {
    expect(PLUGIN_SKILL_ENTRY_FILE.endsWith(PLUGIN_AGENT_INPUT_EXT)).toBe(true);
  });

  it("leaves out no section a plugin is built from", () => {
    for (const built of ["skills", "agents", "hooks"]) {
      expect(OUT_OF_SCOPE_PLUGIN_SECTIONS).not.toContain(built);
    }
  });
});
