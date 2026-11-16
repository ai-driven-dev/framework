import { describe, expect, it } from "vitest";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";

describe("opencode commands", () => {
  describe("capabilities.commands.buildInstallPath()", () => {
    it("builds AIDD-namespaced path under .opencode/commands/aidd/<phase>/", () => {
      const path = opencode.capabilities.commands?.buildInstallPath("04_code/implement.md");
      expect(path).toBe(".opencode/commands/aidd/04/implement.md");
    });

    it("falls back to aidd/<baseName> for top-level files without a phase directory", () => {
      const path = opencode.capabilities.commands?.buildInstallPath("implement.md");
      expect(path).toBe(".opencode/commands/aidd/implement.md");
    });
  });

  describe("capabilities.commands.convertFrontmatter()", () => {
    it("emits name prefixed with aidd:<phase>: and description", () => {
      const fm = { name: "implement", description: "Implement a plan", model: "gpt-4o" };
      const result = opencode.capabilities.commands?.convertFrontmatter(fm, "04_code/implement.md");
      expect(result).toEqual({ name: "aidd:04:implement", description: "Implement a plan" });
    });

    it("emits bare name when relativeFileName has no leading-digit phase", () => {
      const fm = { name: "implement", description: "Implement a plan" };
      const result = opencode.capabilities.commands?.convertFrontmatter(fm, "implement.md");
      expect(result).toEqual({ name: "implement", description: "Implement a plan" });
    });
  });
});
