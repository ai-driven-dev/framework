import type { CheckFileReferences } from "../../contexts/installation/application/doctor/check-file-references.use-case.js";
import type { CheckMergeFiles } from "../../contexts/installation/application/doctor/check-merge-files.use-case.js";
import type { CheckPluginDrift } from "../../contexts/installation/application/doctor/check-plugin-drift.use-case.js";
import type { CheckProjectLayout } from "../../contexts/installation/application/doctor/check-project-layout.use-case.js";
import type { CheckTrackedFiles } from "../../contexts/installation/application/doctor/check-tracked-files.use-case.js";
import type { LoadManifestForDoctor } from "../../contexts/installation/application/doctor/load-manifest-for-doctor.use-case.js";
import type { DoctorReport } from "../../contexts/installation/contract/doctor-issue.js";
import type { InstalledToolsView } from "../../contexts/installation/contract/installed-tools-view.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { ToolCategory } from "../../shared/domain/tool.js";
import type { CheckAuthentication } from "./check-authentication.use-case.js";
import type { CheckRegistration } from "./check-registration.use-case.js";

export interface RunDoctorRequest {
  projectRoot: string;
  category?: ToolCategory;
  pluginName?: string;
}

/** The installation's own checks, assembled in composition. */
export interface DoctorChecks {
  readonly tracked: CheckTrackedFiles;
  readonly merge: CheckMergeFiles;
  readonly references: CheckFileReferences;
  readonly layout: CheckProjectLayout;
  readonly plugin: CheckPluginDrift;
}

export interface RunDoctorDeps {
  readonly load: LoadManifestForDoctor;
  readonly checks: DoctorChecks;
  readonly registration: Pick<CheckRegistration, "execute">;
  readonly authentication: Pick<CheckAuthentication, "execute">;
}

/**
 * Runs every doctor check over the installation and gathers one report. The order of the
 * issues is the order of the checks: tracked files, merge files, references, registration, then
 * the project layout and the authentication, which a category-scoped run leaves out. Plugin drift
 * is reported apart.
 */
export class RunDoctor {
  constructor(
    private readonly deps: RunDoctorDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: RunDoctorRequest): Promise<DoctorReport> {
    const { projectRoot, category, pluginName } = options;
    const allowedIds = category ? new Set<string>(this.tools.idsInCanonicalOrder(category)) : null;
    const installed: InstalledToolsView = await this.deps.load.execute({ allowedIds });
    const check = { projectRoot, allowedIds };
    const issues = [
      ...(await this.deps.checks.tracked.execute(check)),
      ...(await this.deps.checks.merge.execute(check)),
      ...(await this.deps.checks.references.execute(check)),
      ...(await this.deps.registration.execute({ projectRoot, allowedIds })),
    ];
    if (!category) {
      issues.push(...(await this.deps.checks.layout.execute({ projectRoot })));
      issues.push(...(await this.deps.authentication.execute()));
    }
    const pluginIssues = await this.deps.checks.plugin.execute({
      projectRoot,
      allowedIds,
      pluginName,
    });
    return {
      healthy:
        issues.filter((i) => i.severity !== "info").length === 0 && pluginIssues.length === 0,
      toolHealth: [...installed.toolHealth],
      issues,
      pluginIssues,
    };
  }
}
