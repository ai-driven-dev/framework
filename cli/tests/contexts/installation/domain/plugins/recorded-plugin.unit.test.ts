import { describe, expect, it } from "vitest";
import { MalformedPluginScopeError } from "../../../../../src/contexts/installation/contract/installation.error.js";
import type {
  ComponentPathMap,
  McpDigestMap,
  PluginEntryData,
} from "../../../../../src/contexts/installation/domain/plugins/plugin-entry.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import {
  InvalidPluginNameError,
  InvalidPluginVersionError,
} from "../../../../../src/shared/domain/shared.error.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../../shared/testing/saying.builder.js";

it("round-trips exact Cursor project hook provenance through the plugin manifest", () => {
  const data = makePluginData({
    projectHooks: {
      entries: [
        {
          event: "preToolUse",
          command: "node ./.cursor/hooks/my-plugin/pre.js",
          digest: "a".repeat(32),
        },
      ],
      scripts: { ".cursor/hooks/my-plugin/pre.js": "b".repeat(32) },
    },
  });
  const installed = RecordedPlugin.fromJSON(data);
  expect(installed.provenance.projectHooks?.scripts.get(".cursor/hooks/my-plugin/pre.js")).toBe(
    "b".repeat(32)
  );
  expect(RecordedPlugin.fromJSON(installed.toJSON()).toJSON()).toEqual(data);
});

const makeDistribution = (strict?: boolean): PluginDistribution =>
  new PluginDistribution({
    manifest: {
      name: parsePluginName("my-plugin"),
      version: "1.0.0",
      ...(strict === undefined ? {} : { strict }),
    },
    format: TOOL.claude,
    files: [],
    components: { skills: [], commands: [], agents: [], rules: [], hooks: [], mcp: [] },
  });

const makePluginData = (overrides: Partial<PluginEntryData> = {}): PluginEntryData => ({
  name: "my-plugin",
  source: { kind: "github", repo: "owner/my-plugin" },
  version: "1.0.0",
  strict: false,
  files: { ".claude/plugins/my-plugin/CLAUDE.md": "abc123" },
  scope: "project",
  ...overrides,
});

describe("a recorded plugin", () => {
  describe("reading a plugin from JSON", () => {
    it("creates a plugin from valid data", () => {
      const plugin = RecordedPlugin.fromJSON(makePluginData());
      expect(plugin.plugin.name).toBe("my-plugin");
      expect(plugin.plugin.version).toBe("1.0.0");
      expect(plugin.plugin.strict).toBe(false);
    });

    it("throws InvalidPluginNameError when name is invalid", () => {
      expect(() => RecordedPlugin.fromJSON(makePluginData({ name: "My Plugin!" }))).toThrow(
        InvalidPluginNameError
      );
    });

    it("throws InvalidPluginNameError for names with uppercase letters", () => {
      expect(() => RecordedPlugin.fromJSON(makePluginData({ name: "MyPlugin" }))).toThrow(
        InvalidPluginNameError
      );
    });

    it("throws InvalidPluginNameError for names with leading hyphens", () => {
      expect(() => RecordedPlugin.fromJSON(makePluginData({ name: "-plugin" }))).toThrow(
        InvalidPluginNameError
      );
    });

    it("throws InvalidPluginVersionError when version is not semver", () => {
      expect(() => RecordedPlugin.fromJSON(makePluginData({ version: "not-a-version" }))).toThrow(
        InvalidPluginVersionError
      );
    });

    it("throws MalformedPluginScopeError, naming the plugin, when scope is missing", () => {
      const data = makePluginData();
      // Proving the runtime guard a missing field trips, which a type-level `Omit`
      // cannot construct as invalid data.
      delete (data as { scope?: unknown }).scope;
      expect(() => RecordedPlugin.fromJSON(data)).toThrow(MalformedPluginScopeError);
      expect(() => RecordedPlugin.fromJSON(data)).toThrow(saying(/my-plugin/));
    });

    it("throws MalformedPluginScopeError when scope is neither project nor user", () => {
      // A value the type forbids, written the way a hand-edited file would carry it.
      const data = makePluginData();
      (data as { scope: string }).scope = "global";
      expect(() => RecordedPlugin.fromJSON(data)).toThrow(MalformedPluginScopeError);
    });

    it("accepts scope: user", () => {
      const plugin = RecordedPlugin.fromJSON(makePluginData({ scope: "user" }));
      expect(plugin.plugin.scope).toBe("user");
    });

    it("accepts single-segment names", () => {
      const plugin = RecordedPlugin.fromJSON(makePluginData({ name: "plugin" }));
      expect(plugin.plugin.name).toBe("plugin");
    });

    it("accepts multi-segment names", () => {
      const plugin = RecordedPlugin.fromJSON(makePluginData({ name: "my-cool-plugin" }));
      expect(plugin.plugin.name).toBe("my-cool-plugin");
    });

    it("parses files into a ReadonlyMap", () => {
      const plugin = RecordedPlugin.fromJSON(makePluginData());
      expect(plugin.plugin.files.get(".claude/plugins/my-plugin/CLAUDE.md")).toBe("abc123");
    });
  });

  describe("writing a plugin to JSON", () => {
    it("round-trips via fromJSON/toJSON", () => {
      const data = makePluginData();
      const plugin = RecordedPlugin.fromJSON(data);
      expect(plugin.toJSON()).toEqual(data);
    });

    it("round-trips scope, project and user alike", () => {
      expect(RecordedPlugin.fromJSON(makePluginData({ scope: "project" })).toJSON().scope).toBe(
        "project"
      );
      expect(RecordedPlugin.fromJSON(makePluginData({ scope: "user" })).toJSON().scope).toBe(
        "user"
      );
    });
  });

  describe("fromJSON() on a name that starts well and ends badly", () => {
    it("throws InvalidPluginNameError for a name whose tail is not a segment", () => {
      expect(() => RecordedPlugin.fromJSON(makePluginData({ name: "my-plugin_" }))).toThrow(
        InvalidPluginNameError
      );
    });
  });

  describe("toJSON() for a plugin installed from no marketplace", () => {
    it("writes no marketplace key at all", () => {
      const data = makePluginData();

      expect(RecordedPlugin.fromJSON(data).toJSON()).toStrictEqual(data);
    });
  });

  describe("building a plugin from a distribution", () => {
    const source = { kind: "github", repo: "owner/my-plugin" } as const;

    it("is strict only where the distribution's manifest says so", () => {
      expect(
        RecordedPlugin.fromDistribution({
          dist: makeDistribution(true),
          source,
          files: [],
          scope: "project",
        }).plugin.strict
      ).toBe(true);
    });

    it("is lenient where the distribution's manifest says nothing", () => {
      expect(
        RecordedPlugin.fromDistribution({
          dist: makeDistribution(),
          source,
          files: [],
          scope: "project",
        }).plugin.strict
      ).toBe(false);
    });

    it("keeps each installed path's component path", () => {
      const componentPaths = new Map([[".claude/rules/naming.md", "rules/naming.md"]]);

      const plugin = RecordedPlugin.fromDistribution({
        dist: makeDistribution(),
        source,
        files: [],
        scope: "project",
        componentPaths,
      });

      expect([...plugin.provenance.componentPaths]).toStrictEqual([
        [".claude/rules/naming.md", "rules/naming.md"],
      ]);
    });

    it("keeps no component path when handed none", () => {
      const plugin = RecordedPlugin.fromDistribution({
        dist: makeDistribution(),
        source,
        files: [],
        scope: "project",
      });

      expect([...plugin.provenance.componentPaths]).toStrictEqual([]);
    });
  });

  describe("the three maps cannot be swapped", () => {
    it("fails to compile when one map's field is passed where another is expected", () => {
      const plugin = RecordedPlugin.fromJSON(makePluginData());

      function acceptsComponentPaths(_m: ComponentPathMap): void {}
      // @ts-expect-error files is a PathHashMap, not a ComponentPathMap - same runtime
      // shape (ReadonlyMap<string, string>), different brand.
      acceptsComponentPaths(plugin.plugin.files);

      function acceptsMcpEntries(_m: McpDigestMap): void {}
      // @ts-expect-error componentPaths is a ComponentPathMap, not a McpDigestMap.
      acceptsMcpEntries(plugin.provenance.componentPaths);

      // The types are branded, but the underlying maps are still plain ReadonlyMaps at runtime.
      expect(plugin.plugin.files).toBeInstanceOf(Map);
    });
  });
});
