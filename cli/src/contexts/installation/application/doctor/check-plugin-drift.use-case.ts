import type { PluginIssueEntry } from "../../contract/doctor-issue.js";
import type { DetectPluginDrift } from "../shared/detect-plugin-drift.use-case.js";
import type { CheckInstallationCommand } from "./check-installation-command.js";
import type { LoadManifest } from "./load-manifest.use-case.js";

export interface CheckPluginDriftRequest extends CheckInstallationCommand {
  pluginName?: string;
}

export class CheckPluginDrift {
  constructor(
    private readonly loadManifest: LoadManifest,
    private readonly detectPluginDrift: DetectPluginDrift
  ) {}

  async execute(command: CheckPluginDriftRequest): Promise<PluginIssueEntry[]> {
    const { projectRoot, allowedIds, pluginName } = command;
    const manifest = await this.loadManifest.execute();
    const toolIds = manifest
      .getInstalledToolIds()
      .filter((toolId) => allowedIds === null || allowedIds.has(toolId));
    const drifts = await this.detectPluginDrift.execute({
      manifest,
      projectRoot,
      toolIds,
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
