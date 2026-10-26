import { describe, expect, it } from "vitest";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";

describe("codex rules", () => {
  describe("capabilities.rules.buildInstallPath()", () => {
    it("builds path for rules under .codex/rules/", () => {
      const path = codex.capabilities.rules.buildInstallPath("01-standards/naming.md");
      expect(path).toBe(".codex/rules/01-standards/naming.md");
    });

    it("strips .codex.md tool suffix from rules path", () => {
      const path = codex.capabilities.rules.buildInstallPath("01-standards/naming.codex.md");
      expect(path).toBe(".codex/rules/01-standards/naming.md");
    });
  });

  describe("capabilities.rules.convertFrontmatter()", () => {
    it("passes frontmatter through unchanged", () => {
      const fm = { paths: ["src/**/*.ts"], description: "TS rules" };
      const result = codex.capabilities.rules.convertFrontmatter(fm);
      expect(result).toEqual(fm);
    });
  });
});
