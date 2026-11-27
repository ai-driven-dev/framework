import { describe, expect, it, vi } from "vitest";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { pluginRefRecords } from "../../../src/orchestration/plugin/plugin-ref-records.js";

type Rules = Parameters<typeof pluginRefRecords>[0];

function recordsOf() {
  const rules: Rules = {
    refOf: vi.fn((_record, plugin, alias) => `${plugin}@${alias}`),
    withoutRef: vi.fn((record) => ({ ...record, pluginRefs: [] })),
    loadRecords: async () => new Map(),
    saveRecords: async () => undefined,
  };
  return { rules, records: pluginRefRecords(rules) };
}

const plugin = RecordedPlugin.fromJSON({
  name: "aidd-dev",
  source: { kind: "local", path: "/fixture" },
  version: "1.0.0",
  strict: false,
  files: {},
  scope: "project",
  marketplace: "framework",
});

describe("keeping plugin refs in the record", () => {
  it("reads the plugin's ref from the record under the marketplace it came from", () => {
    const { rules, records } = recordsOf();
    const recorded = { pluginRefs: ["aidd-dev@framework"] };

    expect(records.recordedRef(recorded, plugin)).toBe("aidd-dev@framework");
    expect(rules.refOf).toHaveBeenCalledWith(recorded, "aidd-dev", "framework");
  });

  it("drops the ref from the record through the host registration's rule", () => {
    const { rules, records } = recordsOf();
    const recorded = { pluginRefs: ["r"] };

    expect(records.withoutRef(recorded, "r")).toStrictEqual({ pluginRefs: [] });
    expect(rules.withoutRef).toHaveBeenCalledWith(recorded, "r");
  });
});
