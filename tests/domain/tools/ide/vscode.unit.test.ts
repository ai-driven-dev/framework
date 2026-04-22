import { describe, expect, it } from "vitest";
import { vscodeToolConfig } from "../../../../src/domain/tools/ide/vscode.js";

describe("vscodeToolConfig", () => {
  describe("config().outputPath()", () => {
    it("maps vscodeExtensions to .vscode/extensions.json", () => {
      expect(vscodeToolConfig.config().outputPath("vscodeExtensions")).toBe(
        ".vscode/extensions.json"
      );
    });

    it("maps vscodeKeybindings to .vscode/keybindings.json", () => {
      expect(vscodeToolConfig.config().outputPath("vscodeKeybindings")).toBe(
        ".vscode/keybindings.json"
      );
    });

    it("maps vscodeSettings to .vscode/settings.json", () => {
      expect(vscodeToolConfig.config().outputPath("vscodeSettings")).toBe(".vscode/settings.json");
    });

    it("returns null for unknown config names", () => {
      expect(vscodeToolConfig.config().outputPath("unknown")).toBeNull();
    });
  });

  describe("config().mergeStrategy()", () => {
    it("all vscode files preserve user customizations", () => {
      expect(vscodeToolConfig.config().mergeStrategy("vscodeExtensions")).toBe("user-prime");
      expect(vscodeToolConfig.config().mergeStrategy("vscodeKeybindings")).toBe("user-prime");
      expect(vscodeToolConfig.config().mergeStrategy("vscodeSettings")).toBe("user-prime");
    });
  });
});
