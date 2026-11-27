import { join } from "node:path";
import { whenAbsent } from "../../../../shared/domain/reading/json-file.js";
import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { driftOf } from "../../domain/drift.js";
import type { Manifest } from "../../domain/manifest.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import {
  projectHookEntriesEdited,
  recordedHooksLocation,
  recordedProjectHookEntries,
} from "../../domain/project-hooks.model.js";
import { scopeBaseOf } from "../plugin/plugin-target-resolution.js";

export type PluginFileDriftKind = "missing" | "hash-mismatch";

export interface PluginFileDrift {
  relativePath: string;
  kind: PluginFileDriftKind;
}

export interface PluginDrift {
  toolId: AiToolId;
  pluginName: string;
  files: PluginFileDrift[];
  /**
   * True when every one of this plugin's tracked files is missing and the tool installs to a
   * user-scope directory rather than the project: a committed manifest describes that directory as
   * it stood on the machine that wrote it, and on any other it is unpopulated until `aidd sync`
   * runs: not the same fact as a project-scope file someone deleted. `files` stays empty, since
   * there is nothing to enumerate file by file.
   */
  notInstalledOnMachine: boolean;
}

export interface DetectPluginDriftRequest {
  manifest: Manifest;
  projectRoot: string;
  toolIds: Iterable<ToolId>;
  pluginName?: string;
}

/**
 * Single source of truth for "which of a plugin's installed files no longer match the manifest".
 */
export class DetectPluginDrift {
  constructor(
    private readonly fs: FileReader,
    private readonly tools: ToolCatalog,
    private readonly homedir: () => string
  ) {}

  async execute(options: DetectPluginDriftRequest): Promise<PluginDrift[]> {
    const { manifest, projectRoot, toolIds, pluginName } = options;
    const drifts: PluginDrift[] = [];
    for (const toolId of [...toolIds].filter((id) => this.tools.isAiTool(id))) {
      for (const plugin of this.targetPlugins(manifest, toolId, pluginName)) {
        const drift = await this.driftOfPlugin(plugin, toolId, projectRoot);
        if (drift !== null) drifts.push(drift);
      }
    }
    return drifts;
  }

  private targetPlugins(
    manifest: DetectPluginDriftRequest["manifest"],
    toolId: AiToolId,
    pluginName: string | undefined
  ): readonly RecordedPlugin[] {
    const plugins = manifest.getRecordedPlugins(toolId);
    return pluginName ? plugins.filter((p) => p.plugin.name === pluginName) : plugins;
  }

  private async driftOfPlugin(
    recorded: RecordedPlugin,
    toolId: AiToolId,
    projectRoot: string
  ): Promise<PluginDrift | null> {
    const { plugin } = recorded;
    const profile = this.tools.aiProfile(toolId);
    const baseDir = scopeBaseOf(profile, {
      scope: plugin.scope,
      projectRoot,
      homedir: this.homedir,
    });
    const files = [
      ...(await this.driftedFiles(plugin.files, baseDir)),
      ...(await this.editedHookEntries(recorded, profile, projectRoot)),
    ];
    if (files.length === 0) return null;
    const allMissing =
      files.length === plugin.files.size && files.every((f) => f.kind === "missing");
    if (allMissing && plugin.scope === "user") {
      return { toolId, pluginName: plugin.name, files: [], notInstalledOnMachine: true };
    }
    return { toolId, pluginName: plugin.name, files, notInstalledOnMachine: false };
  }

  /** The project hooks file, once the entries the install recorded for this plugin changed. */
  private async editedHookEntries(
    recorded: RecordedPlugin,
    profile: Parameters<typeof recordedHooksLocation>[0],
    projectRoot: string
  ): Promise<PluginFileDrift[]> {
    const entries = recorded.provenance.projectHooks?.entries ?? [];
    const location = recordedHooksLocation(profile);
    if (entries.length === 0 || location === null) return [];
    const { relativePath, format } = location;
    const content = await whenAbsent(() => this.fs.readFile(join(projectRoot, relativePath)), null);
    const current =
      content === null ? [] : recordedProjectHookEntries(format, content, recorded.plugin.name);
    return projectHookEntriesEdited(entries, current)
      ? [{ relativePath, kind: "hash-mismatch" }]
      : [];
  }

  private async driftedFiles(
    files: ReadonlyMap<string, string>,
    baseDir: string
  ): Promise<PluginFileDrift[]> {
    const drifted: PluginFileDrift[] = [];
    for (const [relativePath, expectedHash] of files.entries()) {
      const fullPath = join(baseDir, relativePath);
      if (!(await this.fs.fileExists(fullPath))) {
        drifted.push({ relativePath, kind: "missing" });
        continue;
      }
      const verdict = driftOf(expectedHash, await this.fs.readFileHash(fullPath));
      if (verdict !== "ok") drifted.push({ relativePath, kind: "hash-mismatch" });
    }
    return drifted;
  }
}
