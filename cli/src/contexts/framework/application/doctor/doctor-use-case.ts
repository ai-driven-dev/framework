import { ManifestValidationError, NoManifestError } from "../../../../shared/domain/errors.js";
import type { ToolCategory } from "../../../../shared/domain/tool.js";
import type { CheckFileReferences } from "../../../installation/application/doctor/check-file-references.js";
import type { CheckMergeFiles } from "../../../installation/application/doctor/check-merge-files.js";
import type { CheckPluginDrift } from "../../../installation/application/doctor/check-plugin-drift.js";
import type { CheckProjectLayout } from "../../../installation/application/doctor/check-project-layout.js";
import type { CheckTrackedFiles } from "../../../installation/application/doctor/check-tracked-files.js";
import type {
  DoctorIssue,
  DoctorReport,
  PluginIssueEntry,
  ToolHealth,
} from "../../../installation/contract/doctor-issue.js";
import type { Manifest } from "../../../installation/domain/manifest.js";
import type { ManifestRepository } from "../../../installation/ports/manifest-repository.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { DoctorRegistrationUseCase } from "./doctor-registration-use-case.js";

export interface DoctorOptions {
  projectRoot: string;
  category?: ToolCategory;
  pluginName?: string;
  tools: ToolCatalog;
}

export class DoctorUseCase {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly trackedFiles: CheckTrackedFiles,
    private readonly mergeFiles: CheckMergeFiles,
    private readonly plugin: CheckPluginDrift,
    private readonly references: CheckFileReferences,
    private readonly layout: CheckProjectLayout,
    private readonly registration: DoctorRegistrationUseCase
  ) {}

  async execute(options: DoctorOptions): Promise<DoctorReport> {
    const { projectRoot, category, pluginName, tools } = options;
    const manifest = await this.loadManifest();
    const allowedIds = category ? new Set<string>(tools.idsInCanonicalOrder(category)) : null;
    const toolHealth = this.buildToolHealth(manifest, allowedIds);
    const issues = await this.collectIssues(manifest, projectRoot, allowedIds, tools, category);
    const pluginIssues = await this.plugin.execute({
      projectRoot,
      allowedIds,
      tools,
      pluginName,
    });
    return this.buildReport(toolHealth, issues, pluginIssues);
  }

  private async loadManifest(): Promise<Manifest> {
    let manifest: Manifest | null;
    try {
      manifest = await this.manifestRepo.load();
    } catch {
      throw new ManifestValidationError(
        "Manifest is corrupted (invalid JSON). Run `aidd clean --force` and re-initialize."
      );
    }
    if (manifest === null) throw new NoManifestError();
    return manifest;
  }

  private buildToolHealth(manifest: Manifest, allowedIds: Set<string> | null): ToolHealth[] {
    const toolHealth: ToolHealth[] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      if (allowedIds && !allowedIds.has(toolId)) continue;
      const files = manifest.getToolFiles(toolId);
      const mergeFiles = manifest.getMergeFiles(toolId);
      toolHealth.push({ toolId, fileCount: files.length, mergeFileCount: mergeFiles.length });
    }
    return toolHealth;
  }

  private async collectIssues(
    manifest: Manifest,
    projectRoot: string,
    allowedIds: Set<string> | null,
    tools: ToolCatalog,
    category?: ToolCategory
  ): Promise<DoctorIssue[]> {
    const check = { projectRoot, allowedIds };
    const issues = [
      ...(await this.trackedFiles.execute(check)),
      ...(await this.mergeFiles.execute(check)),
      ...(await this.references.execute(check)),
      ...(await this.registration.execute({ manifest, projectRoot, allowedIds, tools })),
    ];
    if (!category) issues.push(...(await this.layout.execute({ projectRoot, tools })));
    return issues;
  }

  private buildReport(
    toolHealth: ToolHealth[],
    issues: DoctorIssue[],
    pluginIssues: PluginIssueEntry[]
  ): DoctorReport {
    return {
      healthy:
        issues.filter((i) => i.severity !== "info").length === 0 && pluginIssues.length === 0,
      toolHealth,
      issues,
      pluginIssues,
    };
  }
}
