import type { Command } from "commander";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { DoctorAllUseCase } from "../use-cases/global/doctor-all-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check installation health and detect issues across all tools and plugins")
    .action(async () => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const useCase = new DoctorAllUseCase(deps.doctorUseCase);
        const result = await useCase.execute(projectRoot);

        for (const e of result.errors) output.warn(`[${e.scope}] ${e.message}`);

        if (result.healthy) {
          output.success("Installation is healthy");
          return;
        }

        printScopeIssues(output, "AI", result.ai);
        printScopeIssues(output, "IDE", result.ide);
        printScopeIssues(output, "Plugins", result.plugins);
        process.exit(1);
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}

function printScopeIssues(
  output: ReturnType<typeof parseGlobalOptions>["output"],
  label: string,
  report: {
    issues: { severity: string; message: string; fix: string }[];
    pluginIssues: { pluginName: string; toolId: string; issue: string; filePath: string }[];
  } | null
): void {
  if (report === null || (report.issues.length === 0 && report.pluginIssues.length === 0)) return;
  output.print(`\n${label}:`);
  for (const issue of report.issues.filter((i) => i.severity === "info")) {
    output.warn(`  ${issue.message}\n    Fix: ${issue.fix}`);
  }
  for (const issue of report.issues.filter((i) => i.severity !== "info")) {
    const text = `  ${issue.message}\n    Fix: ${issue.fix}`;
    if (issue.severity === "error") output.error(text);
    else output.warn(text);
  }
  for (const pi of report.pluginIssues) {
    output.error(
      `  Plugin ${pi.pluginName} (${pi.toolId}): ${pi.issue} — ${pi.filePath}\n    Fix: Run \`aidd ai restore\``
    );
  }
}
