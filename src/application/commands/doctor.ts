import type { Command } from "commander";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { DoctorUseCase } from "../use-cases/doctor-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check installation health and detect issues")
    .action(async () => {
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      try {
        const deps = await createDeps(projectRoot, { verbose, repo }, output);

        const useCase = new DoctorUseCase(deps.fs, deps.manifestRepo, deps.logger, deps.authReader);
        const report = await useCase.execute({ projectRoot, repo });

        for (const issue of report.issues.filter((i) => i.severity === "info")) {
          output.warn(`${issue.message}\n  Fix: ${issue.fix}`);
        }

        if (report.healthy) {
          const totalFiles =
            report.toolHealth.reduce((s, t) => s + t.fileCount, 0) + report.docsFileCount;
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
        process.exit(1);
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
