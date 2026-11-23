import { describe, expect, it } from "vitest";
import { MalformedPluginScopeError } from "../../../../../src/contexts/installation/contract/installation.error.js";
import type { PluginEntryData } from "../../../../../src/contexts/installation/domain/plugins/plugin-entry.js";
import {
  entryFromRecordedPlugin,
  recordedPluginFromEntry,
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

describe("reading a recorded plugin from an entry", () => {
  it("reads maps and defaults the optional fields", () => {
    const fields = recordedPluginFromEntry(entry());
    expect(fields.plugin.files.get("a.md")).toBe("h1");
    expect(fields.provenance.componentPaths.size).toBe(0);
    expect(fields.provenance.mcpEntries.size).toBe(0);
    expect(fields.machineClaim).toBeUndefined();
  });

  it("rejects an invalid name, version and scope", () => {
    expect(() => recordedPluginFromEntry(entry({ name: "Bad Name" }))).toThrow(
      InvalidPluginNameError
    );
    expect(() => recordedPluginFromEntry(entry({ version: "x" }))).toThrow(
      InvalidPluginVersionError
    );
    expect(() => recordedPluginFromEntry(Object.assign(entry(), { scope: "nowhere" }))).toThrow(
      MalformedPluginScopeError
    );
  });
});

describe("writing an entry from a recorded plugin", () => {
  it("leaves out what is empty", () => {
    const data = entryFromRecordedPlugin(recordedPluginFromEntry(entry()));
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
    expect(entryFromRecordedPlugin(recordedPluginFromEntry(full))).toEqual(full);
  });
});
