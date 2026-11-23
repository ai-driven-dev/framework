import type { CheckProjectLayout } from "../../contexts/installation/application/doctor/check-project-layout.use-case.js";
import type { InspectInstallation } from "../../contexts/installation/application/doctor/inspect-installation.use-case.js";
import { isReportHealthy } from "../../contexts/installation/contract/doctor-verdict.model.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { ToolCategory } from "../../shared/domain/tool.js";
import type { CheckAuthentication } from "./check-authentication.use-case.js";
import type { CheckRegistration } from "./check-registration.use-case.js";
import type { DoctorReport } from "./doctor-report.js";

export interface RunDoctorRequest {
  projectRoot: string;
  category?: ToolCategory;
  pluginName?: string;
}

export interface RunDoctorDeps {
  readonly inspect: Pick<InspectInstallation, "execute">;
  readonly layout: Pick<CheckProjectLayout, "execute">;
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
    const inspection = await this.deps.inspect.execute({ projectRoot, allowedIds, pluginName });
    const issues = [
      ...inspection.fileIssues,
      ...(await this.deps.registration.execute({ projectRoot, allowedIds })),
    ];
    if (!category) {
      issues.push(...(await this.deps.layout.execute({ projectRoot })));
      issues.push(...(await this.deps.authentication.execute()));
    }
    const { toolHealth, pluginIssues } = inspection;
    return {
      healthy: isReportHealthy(issues, pluginIssues),
      toolHealth,
      issues,
      pluginIssues,
    };
  }
}
