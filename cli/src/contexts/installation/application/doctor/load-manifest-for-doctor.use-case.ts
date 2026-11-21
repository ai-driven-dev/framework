import type { ToolHealth } from "../../contract/doctor-issue.js";
import type { InstalledToolsView } from "../../contract/installed-tools-view.js";
import type { LoadManifest } from "./load-manifest.use-case.js";

export interface LoadManifestForDoctorRequest {
  allowedIds: Set<string> | null;
}

/** Loads the installation record for a doctor run and answers with the installed tools. Fails
 * with the loader's own errors when there is no manifest or it cannot be read. */
export class LoadManifestForDoctor {
  constructor(private readonly loadManifest: LoadManifest) {}

  async execute(command: LoadManifestForDoctorRequest): Promise<InstalledToolsView> {
    const manifest = await this.loadManifest.execute();
    const toolIds = manifest.getInstalledToolIds();
    const toolHealth: ToolHealth[] = [];
    for (const toolId of toolIds) {
      if (command.allowedIds && !command.allowedIds.has(toolId)) continue;
      toolHealth.push({
        toolId,
        fileCount: manifest.getToolFiles(toolId).length,
        mergeFileCount: manifest.getMergeFiles(toolId).length,
      });
    }
    return { toolHealth, toolIds };
  }
}
