import type { Command } from "commander";
import type { DoctorReport } from "../../contexts/framework/domain/doctor.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import { UserScopeFilterUnsupportedError } from "../../shared/domain/errors.js";
import type { ToolCategory } from "../../shared/domain/tool.js";
import type { Deps, DepsSliceFactory } from "../deps.js";
import {
  printAllToolsDrift,
  printInventory,
  printPluginIssues,
  printReportErrors,
  printScopeIssues,
  printToolDrift,
  printUserScopeTools,
} from "../display/doctor-display.js";
import { ErrorHandler } from "../error-handler.js";
import type { CLIOutput } from "../output.js";
import { GLOBAL_FLAG_HELP, parseGlobalOptions, resolveScopeFlags } from "./global-options.js";

/** What this command reads of the graph. */
type DoctorKeys =
  | "doctorAllUseCase"
  | "statusAllUseCase"
  | "doctorUseCase"
  | "statusUseCase"
  | "userManifestRepo"
  | "homedir"
  | "environment"
  | "doctorRegistrationUseCase";

async function runFullDoctor(
  deps: Pick<Deps, DoctorKeys>,
  output: CLIOutput,
  projectRoot: string,
  tools: ToolCatalog,
  pluginName: string | undefined
): Promise<void> {
  const doctorResult = await deps.doctorAllUseCase.execute(projectRoot, tools, pluginName);
  const statusResult = await deps.statusAllUseCase.execute(projectRoot, tools);
  printReportErrors(output, doctorResult.errors);

  printInventory(output, "AI", doctorResult.ai, statusResult.aiTools.tools);
  printInventory(output, "IDE", doctorResult.ide, statusResult.ideTools.tools);

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
  // cannot flip the exit code — the silent-exit-1 shape the narrowing exists to prevent.
  const healthy =
    pluginName !== undefined ? doctorResult.pluginIssues.length === 0 : doctorResult.healthy;
  if (healthy) {
    output.success("\nInstallation is healthy");
    return;
  }
  process.exit(1);
}

async function runScopedDoctor(
  deps: Pick<Deps, DoctorKeys>,
  output: CLIOutput,
  projectRoot: string,
  toolId: string,
  tools: ToolCatalog,
  pluginName: string | undefined
): Promise<void> {
  const category: ToolCategory = tools.isAiTool(toolId) ? "ai" : "ide";
  // DoctorUseCase scopes by category, never by tool: the inventory below narrows to the exact
  // tool, the issue list stays category-wide.
  const doctorReport = await deps.doctorUseCase.execute({
    projectRoot,
    category,
    pluginName,
    tools,
  });
  const statusReport = await deps.statusUseCase.execute({
    projectRoot,
    filterToolId: toolId,
    pluginName,
    tools,
  });

  const scopedReport: DoctorReport = {
    ...doctorReport,
    toolHealth: doctorReport.toolHealth.filter((h) => h.toolId === toolId),
  };
  printInventory(output, toolId, scopedReport, statusReport.tools);

  printToolDrift(output, statusReport);

  // Unconditional, before the health gate — see the unscoped path above.
  if (pluginName === undefined) {
    printScopeIssues(output, toolId, doctorReport);
  }
  printPluginIssues(output, doctorReport.pluginIssues);

  // Same plugin-scoped gate as the unscoped path above — see the comment there.
  const healthy =
    pluginName !== undefined ? doctorReport.pluginIssues.length === 0 : doctorReport.healthy;
  if (healthy) {
    output.success("\nInstallation is healthy");
    return;
  }
  process.exit(1);
}

/** A user-scope install writes nothing under any project, so the only check left is
 * `doctorRegistrationUseCase` against the user manifest: registrations versus a host's own
 * registry file, the one check that is not project-file-shaped. */
async function runUserScopeDoctor(
  tools: ToolCatalog,
  deps: Pick<Deps, DoctorKeys>,
  output: CLIOutput,
  projectRoot: string,
  cmdOptions: DoctorCmdOptions
): Promise<void> {
  // At user scope doctor checks registrations, not plugin files — there is nothing `--plugin`
  // could narrow — so it is refused rather than silently read and discarded.
  if (cmdOptions.plugin !== undefined) {
    throw new UserScopeFilterUnsupportedError("--plugin", "doctor --plugin <name>");
  }
  const manifest = await deps.userManifestRepo.load();
  if (manifest === null) {
    output.success("Nothing registered at user scope yet — run `aidd setup --global` first.");
    return;
  }
  const { tool } = cmdOptions;
  const toolIds: readonly string[] = tool === undefined ? manifest.getInstalledToolIds() : [tool];
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
        version: manifest.getToolVersion(id) ?? "unknown",
        settings: settingsFile ?? "no user-scope settings file",
      };
    })
  );
  const allowedIds = tool === undefined ? null : new Set([tool]);
  const issues = await deps.doctorRegistrationUseCase.execute({
    manifest,
    projectRoot,
    allowedIds,
    tools,
    globalInstall: true,
  });
  printScopeIssues(output, "User scope", { issues });
  const healthy = issues.every((i) => i.severity !== "error");
  if (healthy) {
    output.success("\nUser-scope installation is healthy");
    return;
  }
  process.exit(1);
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
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const scope = resolveScopeFlags(cmdOptions, output) ?? "project";
        if (scope === "user") {
          await runUserScopeDoctor(tools, deps, output, projectRoot, cmdOptions);
        } else if (cmdOptions.tool !== undefined) {
          await runScopedDoctor(
            deps,
            output,
            projectRoot,
            cmdOptions.tool,
            tools,
            cmdOptions.plugin
          );
        } else {
          await runFullDoctor(deps, output, projectRoot, tools, cmdOptions.plugin);
        }
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
