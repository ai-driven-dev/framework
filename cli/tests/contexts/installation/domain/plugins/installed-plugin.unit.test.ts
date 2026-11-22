import { describe, expect, it } from "vitest";
import { parsePluginSpec } from "../../../../../src/contexts/installation/contract/plugin-spec.js";
import type { PluginEntryData } from "../../../../../src/contexts/installation/domain/plugins/plugin-entry.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";

const makePluginData = (overrides: Partial<PluginEntryData> = {}): PluginEntryData => ({
  name: "my-plugin",
  source: { kind: "github", repo: "owner/my-plugin" },
  version: "1.0.0",
  strict: false,
  files: { ".claude/plugins/my-plugin/CLAUDE.md": "abc123" },
  scope: "project",
  ...overrides,
});

const installed = () => RecordedPlugin.fromJSON(makePluginData()).plugin;

describe("an installed plugin", () => {
  describe("asking whether a file is tracked", () => {
    it("returns true for a tracked file path", () => {
      const plugin = installed();
      expect(plugin.isFileTracked(".claude/plugins/my-plugin/CLAUDE.md")).toBe(true);
    });

    it("returns false for an untracked file path", () => {
      const plugin = installed();
      expect(plugin.isFileTracked(".claude/agents/alexia.md")).toBe(false);
    });
  });

  describe("changing the version", () => {
    it("returns a new plugin with the updated version", () => {
      const plugin = installed();
      const updated = plugin.withVersion("2.0.0");
      expect(updated.version).toBe("2.0.0");
      expect(plugin.version).toBe("1.0.0");
    });

    it("preserves all other fields", () => {
      const plugin = installed();
      const updated = plugin.withVersion("2.0.0");
      expect(updated.name).toBe(plugin.name);
      expect(updated.strict).toBe(plugin.strict);
      expect(updated.files).toBe(plugin.files);
      expect(updated.scope).toBe(plugin.scope);
    });
  });

  describe("changing the files", () => {
    it("returns a new plugin with updated files", () => {
      const plugin = installed();
      const newFiles = new Map([["new/path.md", "hash-value"]]);
      const updated = plugin.withFiles(newFiles);
      expect(updated.files.get("new/path.md")).toBe("hash-value");
      expect(plugin.files.has("new/path.md")).toBe(false);
    });

    it("preserves all other fields", () => {
      const plugin = installed();
      const updated = plugin.withFiles(new Map());
      expect(updated.name).toBe(plugin.name);
      expect(updated.version).toBe(plugin.version);
      expect(updated.scope).toBe(plugin.scope);
    });
  });
});

describe("parsePluginSpec - a plugin argument as typed on the command line", () => {
  it("reads the version after the last @", () => {
    expect(parsePluginSpec("aidd-context@1.2.3")).toStrictEqual({
      name: "aidd-context",
      version: "1.2.3",
    });
  });

  it("reads a bare name as the name alone, requesting no version", () => {
    expect(parsePluginSpec("aidd-context")).toStrictEqual({ name: "aidd-context" });
  });

  it("keeps a leading @ as part of a scoped name", () => {
    expect(parsePluginSpec("@scope/plugin")).toStrictEqual({ name: "@scope/plugin" });
  });

  it("splits a scoped name from its version at the last @", () => {
    expect(parsePluginSpec("@scope/plugin@2.0.0")).toStrictEqual({
      name: "@scope/plugin",
      version: "2.0.0",
    });
  });
});
