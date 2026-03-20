import type { Command } from "commander";
import { createDeps } from "../../infrastructure/deps.js";
import { CLIOutput } from "../output.js";
import { DoctorUseCase } from "../use-cases/doctor-use-case.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check installation health and detect issues")
    .action(async () => {
      const globalOptions = program.opts<{
        verbose: boolean;
        repo?: string;
        token?: string;
      }>();
      const verbose = globalOptions.verbose ?? false;
      const output = new CLIOutput(verbose);
      const projectRoot = process.cwd();

      try {
        const deps = await createDeps(
          projectRoot,
          {
            verbose,
            repo: globalOptions.repo,
            token: globalOptions.token,
          },
          output
        );

        const useCase = new DoctorUseCase(deps.fs, deps.manifestRepo, deps.logger);
        const report = await useCase.execute({ projectRoot, repo: globalOptions.repo });

        if (report.healthy) {
          const totalFiles =
            report.toolHealth.reduce((s, t) => s + t.fileCount, 0) + report.docsFileCount;
          const toolCount = report.toolHealth.length;
          output.success(
            `Installation is healthy (${totalFiles} files tracked across ${toolCount} ${toolCount === 1 ? "tool" : "tools"})`
          );
          return;
        }

        for (const issue of report.issues) {
          const text = `${issue.message}\n  Fix: ${issue.fix}`;
          if (issue.severity === "error") {
            output.error(text);
          } else {
            output.warn(text);
          }
        }
        process.exit(1);
      } catch (error) {
        output.exit(error);
      }
    });
}
