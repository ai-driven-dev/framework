import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";
import { isDoctorHealthy } from "../../../orchestration/doctor/doctor-all.js";
import type { ToolCategory } from "../../../shared/domain/tool.js";
import {
  printAllToolsDrift,
  printInventory,
  printPluginIssues,
  printReportErrors,
  printScopeIssues,
  printToolDrift,
} from "../../presenters/doctor.presenter.js";
import { concludeDoctor, type DoctorRun } from "./doctor-run.controller.js";

export async function runFullDoctor({
  deps,
  output,
  projectRoot,
  pluginName,
}: DoctorRun & { pluginName: string | undefined }): Promise<void> {
  const doctorResult = await deps.doctorAll.execute(projectRoot, pluginName);
  const statusResult = await deps.reportAllStatus.execute(projectRoot);
  printReportErrors(output, doctorResult.errors);
  printInventory(output, {
    label: "AI",
    doctorReport: doctorResult.ai,
    statusTools: statusResult.aiTools.tools,
  });
  printInventory(output, {
    label: "IDE",
    doctorReport: doctorResult.ide,
    statusTools: statusResult.ideTools.tools,
  });
  printAllToolsDrift(output, statusResult);
  // Before the health gate and unconditional: an `info` issue must survive a healthy run,
  // never be held back until something else fails.
  if (pluginName === undefined) {
    printScopeIssues(output, "AI", doctorResult.ai);
    printScopeIssues(output, "IDE", doctorResult.ide);
  }
  printPluginIssues(output, doctorResult.pluginIssues);
  concludeDoctor(output, doctorResult.healthy, "\nInstallation is healthy");
}

export async function runScopedDoctor({
  deps,
  output,
  projectRoot,
  toolId,
  tools,
  pluginName,
}: DoctorRun & {
  toolId: string;
  tools: ToolCatalog;
  pluginName: string | undefined;
}): Promise<void> {
  const category: ToolCategory = tools.isAiTool(toolId) ? "ai" : "ide";
  // DoctorUseCase scopes by category, never by tool: the inventory below narrows to the exact
  // tool, the issue list stays category-wide.
  const doctorReport = await deps.runDoctor.execute({ projectRoot, category, pluginName });
  const statusReport = await deps.reportStatus.execute({
    projectRoot,
    filterToolId: toolId,
    pluginName,
  });
  printInventory(output, {
    label: toolId,
    doctorReport: {
      ...doctorReport,
      toolHealth: doctorReport.toolHealth.filter((health) => health.toolId === toolId),
    },
    statusTools: statusReport.tools,
  });
  printToolDrift(output, statusReport);
  // Unconditional, before the health gate: see the unscoped path above.
  if (pluginName === undefined) {
    printScopeIssues(output, toolId, doctorReport);
  }
  printPluginIssues(output, doctorReport.pluginIssues);
  concludeDoctor(output, isDoctorHealthy(doctorReport, pluginName), "\nInstallation is healthy");
}
