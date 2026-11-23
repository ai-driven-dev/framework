import type { DoctorIssue, PluginIssueEntry, ToolHealth } from "../../contract/doctor-issue.js";
import type { Manifest } from "../../domain/manifest.js";
import type { CheckFileReferences } from "./check-file-references.use-case.js";
import type { CheckMergeFiles } from "./check-merge-files.use-case.js";
import type { CheckPluginDrift, CheckPluginDriftRequest } from "./check-plugin-drift.use-case.js";
import type { CheckTrackedFiles } from "./check-tracked-files.use-case.js";
import type { LoadManifest } from "./load-manifest.use-case.js";

/** What the installation's record says about itself: the health of each allowed tool, the issues
 * of the files it tracks, merges and references, in that order, and the drift of its plugins. */
export interface InstallationInspection {
  readonly toolHealth: ToolHealth[];
  readonly fileIssues: DoctorIssue[];
  readonly pluginIssues: PluginIssueEntry[];
}

export interface InspectInstallationDeps {
  readonly load: Pick<LoadManifest, "execute">;
  readonly tracked: Pick<CheckTrackedFiles, "execute">;
  readonly merge: Pick<CheckMergeFiles, "execute">;
  readonly references: Pick<CheckFileReferences, "execute">;
  readonly plugin: Pick<CheckPluginDrift, "execute">;
}

/** Runs the doctor checks the installation answers from its own record. Fails with the loader's
 * errors when there is no manifest or it cannot be read. */
export class InspectInstallation {
  constructor(private readonly deps: InspectInstallationDeps) {}

  async execute(request: CheckPluginDriftRequest): Promise<InstallationInspection> {
    const { projectRoot, allowedIds } = request;
    const toolHealth = toolHealthOf(await this.deps.load.execute(), allowedIds);
    const check = { projectRoot, allowedIds };
    const fileIssues = [
      ...(await this.deps.tracked.execute(check)),
      ...(await this.deps.merge.execute(check)),
      ...(await this.deps.references.execute(check)),
    ];
    const pluginIssues = await this.deps.plugin.execute(request);
    return { toolHealth, fileIssues, pluginIssues };
  }
}

function toolHealthOf(manifest: Manifest, allowedIds: ReadonlySet<string> | null): ToolHealth[] {
  return manifest
    .getInstalledToolIds()
    .filter((toolId) => allowedIds === null || allowedIds.has(toolId))
    .map((toolId) => ({
      toolId,
      fileCount: manifest.getToolFiles(toolId).length,
      mergeFileCount: manifest.getMergeFiles(toolId).length,
    }));
}
