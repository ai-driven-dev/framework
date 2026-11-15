import type { DetectPluginDriftCommand } from "../../../installation/application/shared/detect-plugin-drift-use-case.js";
import type { Manifest } from "../../../installation/domain/manifest.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { PluginIssueEntry } from "../../domain/doctor.js";

export interface DoctorPluginOptions {
  manifest: Manifest;
  projectRoot: string;
  allowedIds: Set<string> | null;
  tools: ToolCatalog;
  pluginName?: string;
}

export class DoctorPluginUseCase {
  constructor(private readonly detectPluginDrift: DetectPluginDriftCommand) {}

  async execute(options: DoctorPluginOptions): Promise<PluginIssueEntry[]> {
    const { manifest, projectRoot, allowedIds, pluginName, tools } = options;
    const toolIds = manifest
      .getInstalledToolIds()
      .filter((toolId) => allowedIds === null || allowedIds.has(toolId));
    const drifts = await this.detectPluginDrift.execute({
      manifest,
      projectRoot,
      toolIds,
      tools,
      pluginName,
    });
    return drifts.flatMap((drift): PluginIssueEntry[] => {
      if (drift.notInstalledOnMachine) {
        return [
          { toolId: drift.toolId, pluginName: drift.pluginName, issue: "not-installed-on-machine" },
        ];
      }
      return drift.files.map((file) => ({
        toolId: drift.toolId,
        pluginName: drift.pluginName,
        issue: file.kind,
        filePath: file.relativePath,
      }));
    });
  }
}
