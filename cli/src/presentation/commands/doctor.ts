import type { Command } from "commander";
import type { DoctorReport } from "../../contexts/installation/contract/doctor-issue.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { Deps, DepsSliceFactory } from "../../orchestration/deps.js";
import type { Output } from "../../orchestration/domain/output.js";
import type { ToolCategory } from "../../shared/domain/tool.js";
import {
  printAllToolsDrift,
  printInventory,
  printPluginIssues,
  printReportErrors,
  printScopeIssues,
  printToolDrift,
  printUserScopeTools,
} from "../display/doctor-display.js";
import { failCommand } from "../errors/error-translator.js";
import { GLOBAL_FLAG_HELP, parseGlobalOptions, resolveScopeFlags } from "./global-options.js";

/** What this command reads of the graph. */
type DoctorKeys =
  | "doctorAllUseCase"
  | "statusAllUseCase"
  | "doctorUseCase"
  | "statusUseCase"
  | "runUserScopeDoctor"
  | "homedir"
  | "environment";

interface DoctorRun {
  deps: Pick<Deps, DoctorKeys>;
  output: Output;
  projectRoot: string;
}

async function runFullDoctor({
  deps,
  output,
  projectRoot,
  pluginName,
}: DoctorRun & { pluginName: string | undefined }): Promise<void> {
  const doctorResult = await deps.doctorAllUseCase.execute(projectRoot, pluginName);
  const statusResult = await deps.statusAllUseCase.execute(projectRoot);
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

  // Drift is informational and never gates the exit code; only structural health issues do.
  // `--plugin` narrows that gate to one plugin's issues, so a warning this view never prints
  // cannot flip the exit code: the silent-exit-1 shape the narrowing exists to prevent.
  const healthy =
    pluginName !== undefined ? doctorResult.pluginIssues.length === 0 : doctorResult.healthy;
  if (healthy) {
    output.success("\nInstallation is healthy");
    return;
  }
  output.exit(1);
}

async function runScopedDoctor({
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
  const doctorReport = await deps.doctorUseCase.execute({
    projectRoot,
    category,
    pluginName,
  });
  const statusReport = await deps.statusUseCase.execute({
    projectRoot,
    filterToolId: toolId,
    pluginName,
  });

  const scopedReport: DoctorReport = {
    ...doctorReport,
    toolHealth: doctorReport.toolHealth.filter((h) => h.toolId === toolId),
  };
  printInventory(output, {
    label: toolId,
    doctorReport: scopedReport,
    statusTools: statusReport.tools,
  });

  printToolDrift(output, statusReport);

  // Unconditional, before the health gate: see the unscoped path above.
  if (pluginName === undefined) {
    printScopeIssues(output, toolId, doctorReport);
  }
  printPluginIssues(output, doctorReport.pluginIssues);

  // Same plugin-scoped gate as the unscoped path above: see the comment there.
  const healthy =
    pluginName !== undefined ? doctorReport.pluginIssues.length === 0 : doctorReport.healthy;
  if (healthy) {
    output.success("\nInstallation is healthy");
    return;
  }
  output.exit(1);
}

/** A user-scope install writes nothing under any project: the scenario checks the registrations
 * against the user manifest, and this prints what it finds as it finds it. */
async function runUserScopeDoctor({
  tools,
  deps,
  output,
  projectRoot,
  cmdOptions,
}: DoctorRun & { tools: ToolCatalog; cmdOptions: DoctorCmdOptions }): Promise<void> {
  const { tool } = cmdOptions;
  const issues = await deps.runUserScopeDoctor.execute(
    { projectRoot, tool, plugin: cmdOptions.plugin },
    {
      registered: (manifest) => {
        const toolIds: readonly string[] = tool === undefined ? manifest.toolIds : [tool];
        printUserScopeTools(
          output,
          toolIds.map((id) => {
            const profile = tools.profile(id);
            const settingsFile =
              profile.kind === "ai"
                ? profile
                    .nativeActivation()
                    ?.userSettingsFile(deps.homedir(), (name) => deps.environment.get(name))
                : undefined;
            return {
              toolId: profile.toolId,
              version: manifest.versionOf(id) ?? "unknown",
              settings: settingsFile ?? "no user-scope settings file",
            };
          })
        );
      },
    }
  );
  if (issues === null) {
    output.success("Nothing registered at user scope yet — run `aidd setup --global` first.");
    return;
  }
  printScopeIssues(output, "User scope", { issues });
  const healthy = issues.every((i) => i.severity !== "error");
  if (healthy) {
    output.success("\nUser-scope installation is healthy");
    return;
  }
  output.exit(1);
}

interface DoctorCmdOptions {
  tool?: string;
  plugin?: string;
  scope?: string;
  global?: boolean;
}

export function registerDoctorCommand(
  program: Command,
  tools: ToolCatalog,
  createDeps: DepsSliceFactory<DoctorKeys>
): void {
  program
    .command("doctor")
    .description(
      "Detected and equipped tools, plugins, drift, and problems — across all tools or one"
    )
    .option("--tool <tool>", "Limit to a specific AI or IDE tool")
    .option("--plugin <name>", "Limit plugin checks to a specific plugin")
    .option(
      "--scope <scope>",
      "project (default) checks this project's own manifest; user checks the " +
        "machine-wide manifest --scope user setup wrote"
    )
    .option("--global", GLOBAL_FLAG_HELP)
    .action(async (cmdOptions: DoctorCmdOptions) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const scope = resolveScopeFlags(cmdOptions, output) ?? "project";
        if (scope === "user") {
          await runUserScopeDoctor({ tools, deps, output, projectRoot, cmdOptions });
        } else if (cmdOptions.tool !== undefined) {
          await runScopedDoctor({
            deps,
            output,
            projectRoot,
            toolId: cmdOptions.tool,
            tools,
            pluginName: cmdOptions.plugin,
          });
        } else {
          await runFullDoctor({ deps, output, projectRoot, pluginName: cmdOptions.plugin });
        }
      } catch (error) {
        failCommand(output, error);
      }
    });
}
