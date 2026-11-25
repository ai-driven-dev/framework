import type { ToolRecords } from "../../../../src/contexts/installation/contract/records/scope-records.js";
import type { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import type { PluginEntryData } from "../../../../src/contexts/installation/domain/plugins/plugin-entry.js";
import { RecordedPlugin } from "../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { AiToolId } from "../../../../src/shared/domain/tool.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "./manifest.builder.js";

export const SELECTION_ROOT = "/test-project";
export const SELECTION_OTHER_ROOT = "/another-project";
export const SELECTED_PLUGIN = "wanted-plugin";

export function anInstalledPlugin(overrides: Partial<PluginEntryData> = {}): RecordedPlugin {
  return RecordedPlugin.fromJSON({
    name: SELECTED_PLUGIN,
    source: { kind: "local", path: "/plugin-source" },
    version: "1.0.0",
    strict: false,
    files: {},
    scope: "user",
    ...overrides,
  });
}

export function aMachineWithClaudeAndCursor(): Manifest {
  return aManifest().withTool(TOOL.cursor, []).withTool(TOOL.claude, []).build();
}

/** The records of a machine on which each named plugin is held by the same projects, on each tool. */
export function pluginsHeldBy(
  toolIds: readonly AiToolId[],
  names: readonly string[],
  dependents: readonly string[]
): ToolRecords {
  return new Map(
    toolIds.map((toolId) => [
      toolId,
      { pluginClaims: names.map((plugin) => ({ plugin, dependents: [...dependents] })) },
    ])
  );
}

/** Sets the projects holding a plugin as its claim in the tool's record, beside the others. */
export function holdPlugin(
  records: ToolRecords,
  toolId: AiToolId,
  plugin: string,
  dependents: readonly string[]
): void {
  const record = records.get(toolId);
  const kept = Array.isArray(record?.pluginClaims) ? record.pluginClaims : [];
  const others = kept.filter((claim) => claim.plugin !== plugin);
  records.set(toolId, {
    ...record,
    pluginClaims: [...others, { plugin, dependents: [...dependents] }],
  });
}
