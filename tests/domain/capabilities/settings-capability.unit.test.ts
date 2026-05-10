import { describe, expect, it } from "vitest";
import { SettingsCapability } from "../../../src/domain/capabilities/settings-capability.js";

describe("SettingsCapability", () => {
  describe("constructor", () => {
    it("accepts consumes without staticContent", () => {
      const cap = new SettingsCapability({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
        consumes: ["mySignal"],
      });
      expect(cap.consumes).toContain("mySignal");
      expect(cap.staticContent).toBeUndefined();
    });

    it("accepts staticContent without consumes", () => {
      const cap = new SettingsCapability({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
        staticContent: '{"key": true}',
      });
      expect(cap.staticContent).toBe('{"key": true}');
      expect(cap.consumes).toHaveLength(0);
    });

    it("throws when both consumes and staticContent are provided", () => {
      expect(
        () =>
          new SettingsCapability({
            outputPath: ".vscode/settings.json",
            mergeStrategy: "framework-prime",
            consumes: ["mySignal"],
            staticContent: '{"key": true}',
          })
      ).toThrow("SettingsCapability: set either 'consumes' or 'staticContent', not both.");
    });

    it("accepts neither consumes nor staticContent (empty capability)", () => {
      const cap = new SettingsCapability({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
      });
      expect(cap.consumes).toHaveLength(0);
      expect(cap.staticContent).toBeUndefined();
    });
  });

  describe("buildOutputPath", () => {
    it("returns the configured output path", () => {
      const cap = new SettingsCapability({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
      });
      expect(cap.buildOutputPath()).toBe(".vscode/settings.json");
    });
  });

  describe("getMergeStrategy", () => {
    it("returns the configured merge strategy", () => {
      const cap = new SettingsCapability({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "user-prime",
      });
      expect(cap.getMergeStrategy()).toBe("user-prime");
    });
  });
});
