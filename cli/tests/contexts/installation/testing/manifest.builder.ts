import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import type { InstalledPlugin } from "../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import type { InstallationFile } from "../../../../src/shared/domain/installation-file.js";
import type { MergeFileEntry } from "../../../../src/shared/domain/merge.js";
import type { ToolId } from "../../../../src/shared/domain/tool.js";

const DEFAULT_TOOL_VERSION = "1.0.0";

interface ToolOptions {
  readonly version?: string;
  readonly mergeFiles?: MergeFileEntry[];
}

/** A manifest set up in one expression: each tool with its files, each plugin under its tool. */
export function aManifest() {
  const manifest = Manifest.create();
  const builder = {
    withTool(toolId: ToolId, files: InstallationFile[], options: ToolOptions = {}) {
      manifest.addTool(toolId, options.version ?? DEFAULT_TOOL_VERSION, files);
      manifest.updateToolMergeFiles(toolId, options.mergeFiles ?? []);
      return builder;
    },
    withPlugin(toolId: ToolId, plugin: InstalledPlugin) {
      manifest.addPlugin(toolId, plugin);
      return builder;
    },
    build: () => manifest,
  };
  return builder;
}
