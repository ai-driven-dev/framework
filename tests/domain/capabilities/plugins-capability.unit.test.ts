import { describe, expect, it } from "vitest";
import { PluginsCapability } from "../../../src/domain/capabilities/plugins-capability.js";

describe("PluginsCapability", () => {
  describe("native mode", () => {
    const cap = new PluginsCapability({
      mode: "native",
      pluginsDir: ".claude/plugins/",
      pluginManifestRelativePath: ".claude-plugin/plugin.json",
    });

    it("exposes mode as native", () => {
      expect(cap.mode).toBe("native");
    });

    it("exposes pluginsDir", () => {
      expect(cap.pluginsDir).toBe(".claude/plugins/");
    });

    it("exposes pluginManifestRelativePath", () => {
      expect(cap.pluginManifestRelativePath).toBe(".claude-plugin/plugin.json");
    });

    it("flatNamespacePrefix is null", () => {
      expect(cap.flatNamespacePrefix).toBeNull();
    });

    it("pluginOutputDir returns the plugin subdirectory", () => {
      expect(cap.pluginOutputDir("my-plugin")).toBe(".claude/plugins/my-plugin/");
    });
  });

  describe("flat mode", () => {
    const cap = new PluginsCapability({
      mode: "flat",
      flatNamespacePrefix: "aidd-",
    });

    it("exposes mode as flat", () => {
      expect(cap.mode).toBe("flat");
    });

    it("exposes flatNamespacePrefix", () => {
      expect(cap.flatNamespacePrefix).toBe("aidd-");
    });

    it("pluginsDir is null", () => {
      expect(cap.pluginsDir).toBeNull();
    });

    it("pluginManifestRelativePath is null", () => {
      expect(cap.pluginManifestRelativePath).toBeNull();
    });

    it("pluginOutputDir returns null", () => {
      expect(cap.pluginOutputDir("my-plugin")).toBeNull();
    });
  });

  describe("unsupported mode", () => {
    const cap = new PluginsCapability({ mode: "unsupported" });

    it("exposes mode as unsupported", () => {
      expect(cap.mode).toBe("unsupported");
    });

    it("pluginsDir is null", () => {
      expect(cap.pluginsDir).toBeNull();
    });

    it("pluginManifestRelativePath is null", () => {
      expect(cap.pluginManifestRelativePath).toBeNull();
    });

    it("flatNamespacePrefix is null", () => {
      expect(cap.flatNamespacePrefix).toBeNull();
    });

    it("pluginOutputDir returns null", () => {
      expect(cap.pluginOutputDir("any-plugin")).toBeNull();
    });
  });
});
