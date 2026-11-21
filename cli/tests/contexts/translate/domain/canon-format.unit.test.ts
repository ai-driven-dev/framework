import { posix } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OUT_OF_SCOPE_PLUGIN_SECTIONS,
  PLUGIN_AGENT_INPUT_EXT,
  PLUGIN_SKILL_ENTRY_FILE,
  SOURCE_MARKETPLACE_RELATIVE,
  SOURCE_PLUGIN_MANIFEST_RELATIVE,
} from "../../../../src/contexts/translate/domain/canon-format.js";

describe("canon format", () => {
  it("keeps the plugin manifest and the marketplace catalog in one directory", () => {
    expect(posix.dirname(SOURCE_PLUGIN_MANIFEST_RELATIVE)).toBe(
      posix.dirname(SOURCE_MARKETPLACE_RELATIVE)
    );
    expect(posix.basename(SOURCE_PLUGIN_MANIFEST_RELATIVE)).not.toBe(
      posix.basename(SOURCE_MARKETPLACE_RELATIVE)
    );
  });

  it("writes agents and skill entries in markdown", () => {
    expect(PLUGIN_SKILL_ENTRY_FILE.endsWith(PLUGIN_AGENT_INPUT_EXT)).toBe(true);
  });

  it("leaves out no section a plugin is built from", () => {
    for (const built of ["skills", "agents", "hooks"]) {
      expect(OUT_OF_SCOPE_PLUGIN_SECTIONS).not.toContain(built);
    }
  });
});
