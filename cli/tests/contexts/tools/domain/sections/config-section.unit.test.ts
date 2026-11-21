import { describe, expect, it } from "vitest";
import { ConfigSection } from "../../../../../src/contexts/tools/domain/sections/config-section.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

describe("ConfigSection", () => {
  describe("constructor", () => {
    it("accepts consumes without staticContent", () => {
      const cap = new ConfigSection({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
        consumes: [{ name: "mySignal", path: "config/my.json" }],
      });
      expect(cap.consumes("mySignal")).toBe(true);
      expect(cap.consumes("other")).toBe(false);
      expect(cap.resolveStaticContent()).toBeNull();
    });

    it("accepts staticContent without consumes", () => {
      const cap = new ConfigSection({
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
          new ConfigSection({
            outputPath: ".vscode/settings.json",
            mergeStrategy: "framework-prime",
            consumes: [{ name: "mySignal", path: "config/my.json" }],
            staticContent: '{"key": true}',
          })
      ).toThrow(
        expect.objectContaining({
          detail: expect.stringContaining(
            "ConfigSection: set either 'consumes' or 'staticContent', not both."
          ),
        })
      );
    });

    it("throws when both staticContent and staticContentAssetFile are provided", () => {
      expect(
        () =>
          new ConfigSection({
            outputPath: ".vscode/settings.json",
            mergeStrategy: "framework-prime",
            staticContent: '{"key": true}',
            staticContentAssetFile: "vscode-settings.json",
          })
      ).toThrow(
        expect.objectContaining({
          detail: expect.stringContaining(
            "ConfigSection: set either 'staticContent' or 'staticContentAssetFile', not both."
          ),
        })
      );
    });

    it("throws when consumes and staticContentAssetFile are both provided", () => {
      expect(
        () =>
          new ConfigSection({
            outputPath: ".vscode/settings.json",
            mergeStrategy: "framework-prime",
            consumes: [{ name: "mySignal", path: "config/my.json" }],
            staticContentAssetFile: "vscode-settings.json",
          })
      ).toThrow(
        expect.objectContaining({
          detail: expect.stringContaining(
            "ConfigSection: set either 'consumes' or 'staticContent', not both."
          ),
        })
      );
    });

    it("accepts neither consumes nor staticContent (empty capability)", () => {
      const cap = new ConfigSection({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
      });
      expect(cap.consumes("mySignal")).toBe(false);
      expect(cap.resolveStaticContent()).toBeNull();
    });
  });

  describe("the tool it requires", () => {
    it("applies whatever is installed, and requires no tool, when none is set", () => {
      const cap = new ConfigSection({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
        staticContent: '{"key": true}',
      });
      expect(cap.appliesWith(() => false)).toBe(true);
      expect(cap.requires(TOOL.vscode)).toBe(false);
    });

    it("applies only once the tool it requires is installed, and requires that tool alone", () => {
      const cap = new ConfigSection({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
        staticContent: '{"key": true}',
        requiresTool: TOOL.vscode,
      });
      expect(cap.appliesWith((toolId) => toolId === TOOL.vscode)).toBe(true);
      expect(cap.appliesWith((toolId) => toolId === TOOL.cursor)).toBe(false);
      expect(cap.requires(TOOL.vscode)).toBe(true);
      expect(cap.requires(TOOL.cursor)).toBe(false);
    });

    it("throws when requiresTool is set without staticContent", () => {
      expect(
        () =>
          new ConfigSection({
            outputPath: ".vscode/settings.json",
            mergeStrategy: "framework-prime",
            requiresTool: TOOL.vscode,
          })
      ).toThrow(
        expect.objectContaining({
          detail: expect.stringContaining(
            "ConfigSection: 'requiresTool' is only meaningful with 'staticContent'."
          ),
        })
      );
    });

    it("accepts staticContentAssetFile with requiresTool", () => {
      const cap = new ConfigSection({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
        staticContentAssetFile: "vscode-settings.json",
        requiresTool: TOOL.vscode,
      });
      expect(cap.resolveStaticContent()).toBeNull();
      expect(cap.requires(TOOL.vscode)).toBe(true);
    });
  });

  describe("resolveStaticContent", () => {
    const fromAsset = new ConfigSection({
      outputPath: ".vscode/settings.json",
      mergeStrategy: "framework-prime",
      staticContentAssetFile: "vscode-settings.json",
    });

    it("writes an asset answered as an object as indented JSON", () => {
      expect(fromAsset.resolveStaticContent(() => ({ a: 1 }))).toBe('{\n  "a": 1\n}');
    });

    it("keeps an asset answered as text verbatim, with nothing to consume", () => {
      const loaded: string[] = [];
      expect(
        fromAsset.resolveStaticContent((name) => {
          loaded.push(name);
          return "{}";
        })
      ).toBe("{}");
      expect(loaded).toStrictEqual(["vscode-settings.json"]);
      expect(fromAsset.consumes("mySignal")).toBe(false);
    });

    it("answers nothing for an asset when no loader is given", () => {
      expect(fromAsset.resolveStaticContent()).toBeNull();
    });

    it("prefers inline content and never asks the loader", () => {
      const inline = new ConfigSection({
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

  describe("writes", () => {
    it("answers whether the section writes the destination", () => {
      const cap = new ConfigSection({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
      });
      expect([cap.writes(".vscode/settings.json"), cap.writes(".vscode/other.json")]).toEqual([
        true,
        false,
      ]);
    });
  });

  describe("outputPath", () => {
    it("returns the configured output path", () => {
      const cap = new ConfigSection({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "framework-prime",
      });
      expect(cap.outputPath()).toBe(".vscode/settings.json");
    });
  });

  describe("fileOf", () => {
    it("writes the content at its path, merged its way, from the canonical file named", () => {
      const cap = new ConfigSection({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "user-prime",
      });
      const file = cap.fileOf("{}", { frameworkPath: "config/s.json" });
      expect(file).toMatchObject({
        relativePath: ".vscode/settings.json",
        content: "{}",
        mergeStrategy: "user-prime",
        frameworkPath: "config/s.json",
      });
      expect(file.hash).toEqual(FileHash.of("{}"));
    });
  });
});
