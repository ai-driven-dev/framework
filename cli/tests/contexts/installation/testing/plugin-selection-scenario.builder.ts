import type { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import type { PluginEntryData } from "../../../../src/contexts/installation/domain/plugins/plugin-entry.js";
import { RecordedPlugin } from "../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
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
