import { describe, expect, it } from "vitest";
import { SettingsCapability } from "../../../../../src/contexts/tools/domain/sections/settings-capability.js";

describe("SettingsCapability", () => {
  describe("constructor", () => {
    it("accepts consumes without staticContent", () => {
      const cap = new SettingsCapability({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
        consumes: ["mySignal"],
      });
      expect(cap.consumes("mySignal")).toBe(true);
      expect(cap.consumes("other")).toBe(false);
      expect(cap.resolveStaticContent()).toBeNull();
    });

    it("accepts staticContent without consumes", () => {
      const cap = new SettingsCapability({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
        staticContent: '{"key": true}',
      });
      expect(cap.resolveStaticContent()).toBe('{"key": true}');
      expect(cap.consumes("mySignal")).toBe(false);
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

    it("throws when both staticContent and staticContentAssetFile are provided", () => {
      expect(
        () =>
          new SettingsCapability({
            outputPath: ".vscode/settings.json",
            mergeStrategy: "framework-prime",
            staticContent: '{"key": true}',
            staticContentAssetFile: "vscode-settings.json",
          })
      ).toThrow(
        "SettingsCapability: set either 'staticContent' or 'staticContentAssetFile', not both."
      );
    });

    it("throws when consumes and staticContentAssetFile are both provided", () => {
      expect(
        () =>
          new SettingsCapability({
            outputPath: ".vscode/settings.json",
            mergeStrategy: "framework-prime",
            consumes: ["mySignal"],
            staticContentAssetFile: "vscode-settings.json",
          })
      ).toThrow("SettingsCapability: set either 'consumes' or 'staticContent', not both.");
    });

    it("accepts staticContentAssetFile without consumes", () => {
      const cap = new SettingsCapability({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
        staticContentAssetFile: "vscode-settings.json",
      });
      const loaded: string[] = [];
      expect(
        cap.resolveStaticContent((name) => {
          loaded.push(name);
          return "{}";
        })
      ).toBe("{}");
      expect(loaded).toStrictEqual(["vscode-settings.json"]);
      expect(cap.consumes("mySignal")).toBe(false);
    });

    it("accepts neither consumes nor staticContent (empty capability)", () => {
      const cap = new SettingsCapability({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
      });
      expect(cap.consumes("mySignal")).toBe(false);
      expect(cap.resolveStaticContent()).toBeNull();
    });
  });

  describe("requiredTool", () => {
    it("is null when not set", () => {
      const cap = new SettingsCapability({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
        staticContent: '{"key": true}',
      });
      expect(cap.requiredTool()).toBeNull();
    });

    it("is set when provided alongside staticContent", () => {
      const cap = new SettingsCapability({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
        staticContent: '{"key": true}',
        requiresTool: "vscode",
      });
      expect(cap.requiredTool()).toBe("vscode");
    });

    it("throws when requiresTool is set without staticContent", () => {
      expect(
        () =>
          new SettingsCapability({
            outputPath: ".vscode/settings.json",
            mergeStrategy: "framework-prime",
            requiresTool: "vscode",
          })
      ).toThrow("SettingsCapability: 'requiresTool' is only meaningful with 'staticContent'.");
    });

    it("accepts staticContentAssetFile with requiresTool", () => {
      const cap = new SettingsCapability({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
        staticContentAssetFile: "vscode-settings.json",
        requiresTool: "vscode",
      });
      expect(cap.resolveStaticContent()).toBeNull();
      expect(cap.requiredTool()).toBe("vscode");
    });
  });

  describe("resolveStaticContent", () => {
    const fromAsset = new SettingsCapability({
      outputPath: ".vscode/settings.json",
      mergeStrategy: "framework-prime",
      staticContentAssetFile: "vscode-settings.json",
    });

    it("writes an asset answered as an object as indented JSON", () => {
      expect(fromAsset.resolveStaticContent(() => ({ a: 1 }))).toBe('{\n  "a": 1\n}');
    });

    it("answers nothing for an asset when no loader is given", () => {
      expect(fromAsset.resolveStaticContent()).toBeNull();
    });

    it("prefers inline content and never asks the loader", () => {
      const inline = new SettingsCapability({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
        staticContent: "{}",
      });
      expect(
        inline.resolveStaticContent(() => {
          throw new Error("asked");
        })
      ).toBe("{}");
    });
  });

  describe("outputPath", () => {
    it("returns the configured output path", () => {
      const cap = new SettingsCapability({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
      });
      expect(cap.outputPath()).toBe(".vscode/settings.json");
    });
  });

  describe("mergeStrategy", () => {
    it("returns the configured merge strategy", () => {
      const cap = new SettingsCapability({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "user-prime",
      });
      expect(cap.mergeStrategy()).toBe("user-prime");
    });
  });
});

describe("SettingsCapability path acceptance", () => {
  it("accepts exactly its own output path", () => {
    const cap = new SettingsCapability({
      outputPath: ".vscode/settings.json",
      mergeStrategy: "none",
    });

    expect(cap.accepts(".vscode/settings.json")).toBe(true);
    expect(cap.accepts(".vscode/extensions.json")).toBe(false);
    expect(cap.accepts("x/.vscode/settings.json")).toBe(false);
  });
});

describe("SettingsCapability equality", () => {
  const base = { outputPath: ".vscode/settings.json", mergeStrategy: "none" as const };

  it("is equal on the same output path and merge strategy", () => {
    expect(new SettingsCapability(base).equals(new SettingsCapability({ ...base }))).toBe(true);
  });

  it("differs on the output path", () => {
    expect(
      new SettingsCapability(base).equals(
        new SettingsCapability({ ...base, outputPath: ".vscode/extensions.json" })
      )
    ).toBe(false);
  });

  it("differs on the merge strategy", () => {
    expect(
      new SettingsCapability(base).equals(
        new SettingsCapability({ ...base, mergeStrategy: "user-prime" })
      )
    ).toBe(false);
  });
});
