import type { Command } from "commander";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { DoctorUseCase } from "../use-cases/doctor-use-case.js";
import { parseCategoryArg, parseGlobalOptions } from "./global-options.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check installation health and detect issues")
    .argument("[category]", "Filter to 'ai' or 'ide' tools")
    .option("--plugin <name>", "Filter check to one plugin")
    .action(async (categoryArg: string | undefined, cmdOptions: { plugin?: string }) => {
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      const category = parseCategoryArg(categoryArg, output);

      try {
        const deps = await createDeps(projectRoot, { verbose, repo }, output);

        const useCase = new DoctorUseCase(
          deps.fs,
          deps.manifestRepo,
          deps.hasher,
          deps.logger,
          deps.authReader
        );
        const report = await useCase.execute({
          projectRoot,
          category,
          repo,
          pluginName: cmdOptions.plugin,
        });

        for (const issue of report.issues.filter((i) => i.severity === "info")) {
          output.warn(`${issue.message}\n  Fix: ${issue.fix}`);
        }

        if (report.healthy) {
          const totalFiles =
            report.toolHealth.reduce((s, t) => s + t.fileCount + t.mergeFileCount, 0) +
            report.docsFileCount;
          const toolCount = report.toolHealth.length;
          output.success(
            `Installation is healthy (${totalFiles} files tracked across ${toolCount} ${toolCount === 1 ? "tool" : "tools"})`
          );
          return;
        }

        for (const issue of report.issues.filter((i) => i.severity !== "info")) {
          const text = `${issue.message}\n  Fix: ${issue.fix}`;
          if (issue.severity === "error") {
            output.error(text);
          } else {
            output.warn(text);
          }
        }

        for (const pi of report.pluginIssues) {
          output.error(
            `Plugin ${pi.pluginName} (${pi.toolId}): ${pi.issue} — ${pi.filePath}\n  Fix: Run \`aidd restore --plugin ${pi.pluginName}\` to restore.`
          );
        }

        process.exit(1);
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
