import type { Command } from "commander";
import type { ToolId } from "../../domain/models/tool-config.js";
import { SilentPrompterAdapter } from "../../infrastructure/adapters/prompter-adapter.js";
import { createDeps } from "../../infrastructure/deps.js";
import { printUpdateBanner } from "../check-update.js";
import { CLIOutput } from "../output.js";
import { DoctorUseCase } from "../use-cases/doctor-use-case.js";
import { resolveFrameworkWithFallback } from "../use-cases/resolve-framework-use-case.js";
import { RestoreUseCase } from "../use-cases/restore-use-case.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check installation health and detect issues")
    .option("--fix", "Attempt to auto-fix detected issues", false)
    .action(async (cmdOptions: { fix: boolean }) => {
      const globalOptions = program.opts<{
        verbose: boolean;
        repo?: string;
        token?: string;
        framework?: string;
        release?: string;
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
            framework: globalOptions.framework,
          },
          output
        );

        await printUpdateBanner(deps.resolver, deps.manifestRepo, output);

        const useCase = new DoctorUseCase(deps.fs, deps.manifestRepo, deps.logger);
        const report = await useCase.execute({ projectRoot });

        if (report.healthy && !cmdOptions.fix) {
          const totalFiles =
            report.toolHealth.reduce((s, t) => s + t.fileCount, 0) + report.docsFileCount;
          const toolCount = report.toolHealth.length;
          output.success(
            `Installation is healthy (${totalFiles} files tracked across ${toolCount} ${toolCount === 1 ? "tool" : "tools"})`
          );
          return;
        }

        if (!cmdOptions.fix) {
          for (const issue of report.issues) {
            output.warn(`${issue.message}\n  Fix: ${issue.fix}`);
          }
          process.exit(1);
        }

        // --fix mode: restore all tracked files (missing + modified) then report remaining issues
        const manifest = await deps.manifestRepo.load();
        if (manifest === null) {
          throw new Error("No AIDD installation found. Run `aidd init` first.");
        }

        const orphanedIssues = report.issues.filter((i) =>
          i.message.startsWith("Orphaned directory")
        );

        for (const issue of orphanedIssues) {
          output.warn(`Cannot auto-fix: ${issue.message}\n  Fix: ${issue.fix}`);
        }

        const fixableToolIds: ToolId[] = manifest.getInstalledToolIds();

        if (fixableToolIds.length > 0) {
          output.print("Attempting to restore files from framework...");

          const pinnedVersion = fixableToolIds
            .map((id) => manifest.getToolVersion(id))
            .find((v) => v !== undefined);

          const { path: frameworkPath, version } = await resolveFrameworkWithFallback(
            deps.resolver,
            deps.logger,
            { framework: globalOptions.framework, pinnedVersion, release: globalOptions.release }
          );

          const restoreUseCase = new RestoreUseCase(
            deps.fs,
            deps.manifestRepo,
            deps.loader,
            deps.hasher,
            deps.logger,
            new SilentPrompterAdapter()
          );

          const result = await restoreUseCase.execute({
            frameworkPath,
            version,
            docsDir: manifest.docsDir,
            projectRoot,
            toolIds: fixableToolIds,
            force: true,
            manifest,
          });

          const totalRestored = result.tools.reduce((sum, t) => sum + t.restored.length, 0);
          if (totalRestored > 0) {
            output.success(`Restored ${totalRestored} file(s)`);
          }
        }

        // Re-run doctor to check for remaining issues
        const finalReport = await useCase.execute({ projectRoot });

        if (finalReport.healthy) {
          output.success("All issues resolved. Installation is healthy.");
          return;
        }

        for (const issue of finalReport.issues) {
          output.warn(`${issue.message}\n  Fix: ${issue.fix}`);
        }
        process.exit(1);
      } catch (error) {
        output.exit(error);
      }
    });
}
