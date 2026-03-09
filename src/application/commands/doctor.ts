import type { Command } from "commander";
import { createDeps } from "../../infrastructure/deps.js";
import { printUpdateBanner } from "../check-update.js";
import { CLIOutput } from "../output.js";
import { DoctorUseCase } from "../use-cases/doctor-use-case.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check installation health and detect issues")
    .action(async () => {
      const globalOptions = program.opts<{ verbose: boolean }>();
      const verbose = globalOptions.verbose ?? false;
      const output = new CLIOutput(verbose);
      const projectRoot = process.cwd();

      try {
        const deps = await createDeps(projectRoot, { verbose }, output);

        await printUpdateBanner(deps.resolver, deps.manifestRepo, output);

        const useCase = new DoctorUseCase(deps.fs, deps.manifestRepo, deps.logger);
        const report = await useCase.execute({ projectRoot });

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
          output.warn(`${issue.message}\n  Fix: ${issue.fix}`);
        }
        process.exit(1);
      } catch (error) {
        output.exit(error);
      }
    });
}
