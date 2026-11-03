import { describe, expect, it } from "vitest";
import { copilot } from "../../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";

describe("copilot settings", () => {
  describe("capabilities.settings", () => {
    const settings = Array.isArray(copilot.capabilities.settings)
      ? copilot.capabilities.settings[0]
      : copilot.capabilities.settings;

    it("writes to .vscode/settings.json", () => {
      expect(settings.params.outputPath).toBe(".vscode/settings.json");
    });

    it("uses framework-prime merge strategy", () => {
      expect(settings.getMergeStrategy()).toBe("framework-prime");
    });

    it("references vscode-settings.json asset file (not hardcoded staticContent)", () => {
      expect(settings.staticContentAssetFile).toBe("vscode-settings.json");
      expect(settings.staticContent).toBeUndefined();
    });

    it("does not consume framework signals (content is CLI-owned)", () => {
      expect(settings.consumes).toHaveLength(0);
    });

    it("declares requiresTool: vscode (gate merge to IDE-present context)", () => {
      expect(settings.requiresTool).toBe("vscode");
    });
  });
});
