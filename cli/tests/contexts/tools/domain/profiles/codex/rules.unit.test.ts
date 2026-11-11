import { describe, expect, it } from "vitest";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";

describe("codex rules", () => {
  describe("capabilities.rules.convertFrontmatter()", () => {
    it("passes frontmatter through unchanged", () => {
      const fm = { paths: ["src/**/*.ts"], description: "TS rules" };
      const result = codex.section("rules").convertFrontmatter(fm);
      expect(result).toEqual(fm);
    });
  });
});
