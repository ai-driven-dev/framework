import { describe, expect, it } from "vitest";
import { MalformedPluginScopeError } from "../../../../../src/contexts/installation/domain/installation.error.js";
import type { PluginEntryData } from "../../../../../src/contexts/installation/domain/plugins/plugin-entry.js";
import {
  entryFromPluginFields,
  pluginFieldsFromEntry,
} from "../../../../../src/contexts/installation/domain/plugins/plugin-entry-codec.js";
import {
  InvalidPluginNameError,
  InvalidPluginVersionError,
} from "../../../../../src/shared/domain/shared.error.js";

const entry = (overrides: Partial<PluginEntryData> = {}): PluginEntryData => ({
  name: "my-plugin",
  source: { kind: "github", repo: "owner/my-plugin" },
  version: "1.2.3",
  strict: false,
  files: { "a.md": "h1" },
  scope: "project",
  ...overrides,
});

describe("pluginFieldsFromEntry", () => {
  it("reads maps and defaults the optional fields", () => {
    const fields = pluginFieldsFromEntry(entry());
    expect(fields.files.get("a.md")).toBe("h1");
    expect(fields.componentPaths.size).toBe(0);
    expect(fields.mcpEntries.size).toBe(0);
    expect(fields.dependents).toEqual([]);
  });

  it("rejects an invalid name, version and scope", () => {
    expect(() => pluginFieldsFromEntry(entry({ name: "Bad Name" }))).toThrow(
      InvalidPluginNameError
    );
    expect(() => pluginFieldsFromEntry(entry({ version: "x" }))).toThrow(InvalidPluginVersionError);
    expect(() => pluginFieldsFromEntry(Object.assign(entry(), { scope: "nowhere" }))).toThrow(
      MalformedPluginScopeError
    );
  });
});

describe("entryFromPluginFields", () => {
  it("leaves out what is empty", () => {
    const data = entryFromPluginFields(pluginFieldsFromEntry(entry()));
    expect(Object.keys(data).sort()).toEqual(
      ["files", "name", "scope", "source", "strict", "version"].sort()
    );
  });

  it("round-trips every optional field", () => {
    const full = entry({
      componentPaths: { "a.md": "rules/a.md" },
      mcpEntries: { srv: "d" },
      projectHooks: { entries: [{ event: "e", command: "c", digest: "d" }], scripts: { s: "h" } },
      marketplace: "mk",
      dependents: ["/root"],
    });
    expect(entryFromPluginFields(pluginFieldsFromEntry(full))).toEqual(full);
  });
});
