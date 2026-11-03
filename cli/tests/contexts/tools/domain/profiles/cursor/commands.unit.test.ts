import { describe, expect, it } from "vitest";
import { cursor } from "../../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";

describe("cursor commands", () => {
  describe("capabilities.commands.convertFrontmatter()", () => {
    it("prefixes name with aidd:<phase>: and strips extra fields", () => {
      const fm = { name: "implement", description: "Implement", model: "sonnet" };
      const result = cursor.capabilities.commands?.convertFrontmatter(fm, "04_code/implement.md");
      expect(result).toEqual({ name: "aidd:04:implement", description: "Implement" });
    });
  });

  describe("capabilities.commands.buildInstallPath()", () => {
    it("maps phase-prefixed path to aidd/<phase>/ subfolder", () => {
      const path = cursor.capabilities.commands?.buildInstallPath("04_code/implement.md");
      expect(path).toBe(".cursor/commands/aidd/04/implement.md");
    });

    it("maps top-level file to aidd/ subfolder without phase", () => {
      const path = cursor.capabilities.commands?.buildInstallPath("commit.md");
      expect(path).toBe(".cursor/commands/aidd/commit.md");
    });
  });
});
