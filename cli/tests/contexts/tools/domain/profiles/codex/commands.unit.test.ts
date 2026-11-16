import { describe, expect, it } from "vitest";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";

describe("codex commands", () => {
  describe("capabilities.commands.buildInstallPath()", () => {
    it("maps phase-prefixed path to .codex/commands/aidd/<phase>/ subfolder", () => {
      const path = codex.capabilities.commands.buildInstallPath("04_code/implement.md");
      expect(path).toBe(".codex/commands/aidd/04/implement.md");
    });

    it("maps top-level file to .codex/commands/aidd/ without phase", () => {
      const path = codex.capabilities.commands.buildInstallPath("commit.md");
      expect(path).toBe(".codex/commands/aidd/commit.md");
    });
  });

  describe("capabilities.commands.convertFrontmatter()", () => {
    it("prefixes name with aidd:<phase>: and strips extra fields", () => {
      const fm = { name: "implement", description: "Implement", model: "sonnet" };
      const result = codex.capabilities.commands.convertFrontmatter(fm, "04_code/implement.md");
      expect(result).toEqual({ name: "aidd:04:implement", description: "Implement" });
    });
  });
});
