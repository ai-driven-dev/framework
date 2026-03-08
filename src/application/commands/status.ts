import type { Command } from "commander";
import { type ToolId, VALID_TOOL_IDS } from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import { CLIOutput } from "../output.js";
import { StatusUseCase } from "../use-cases/status-use-case.js";

const STATUS_SYMBOL: Record<string, string> = {
  modified: "~",
  deleted: "-",
  added: "+",
};

function printDriftStats(output: CLIOutput, drifted: { status: string }[]): void {
  const modified = drifted.filter((f) => f.status === "modified").length;
  const deleted = drifted.filter((f) => f.status === "deleted").length;
  const added = drifted.filter((f) => f.status === "added").length;
  output.print(`  ${modified} modified, ${deleted} deleted, ${added} added`);
}

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show drift between disk files and the manifest")
    .option("--tool <toolId>", "Filter output to a specific tool")
    .action(async (cmdOptions: { tool?: string }) => {
      const globalOptions = program.opts<{ verbose: boolean; repo?: string; token?: string }>();
      const verbose = globalOptions.verbose ?? false;
      const output = new CLIOutput(verbose);
      const projectRoot = process.cwd();

      try {
        const deps = await createDeps(
          projectRoot,
          { verbose, repo: globalOptions.repo, token: globalOptions.token },
          output
        );

        if (cmdOptions.tool !== undefined) output.validateTools([cmdOptions.tool], VALID_TOOL_IDS);
        const filterToolId = cmdOptions.tool as ToolId | undefined;

        const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger, deps.resolver);
        const report = await useCase.execute({ projectRoot, filterToolId });

        const hasUpdates =
          report.tools.some((t) => t.updateAvailable) || !!report.docs?.updateAvailable;

        if (report.tools.length === 0 && !filterToolId) {
          output.print("No tools installed. Run `aidd install <tool>` to get started.");
          if (!hasUpdates && report.inSync) return;
        } else if (report.inSync) {
          output.success("All files are in sync");
          if (!hasUpdates) return;
        }

        if (!report.inSync) {
          for (const tool of report.tools) {
            if (tool.drifted.length === 0) continue;
            output.print(`\n${tool.toolId} (v${tool.version}):`);
            for (const file of tool.drifted) {
              output.print(`  ${STATUS_SYMBOL[file.status]} ${file.relativePath}`);
            }
            printDriftStats(output, tool.drifted);
          }

          if (report.docs && report.docs.drifted.length > 0) {
            output.print(`\ndocs (v${report.docs.version}):`);
            for (const file of report.docs.drifted) {
              output.print(`  ${STATUS_SYMBOL[file.status]} ${file.relativePath}`);
            }
            printDriftStats(output, report.docs.drifted);
          }
        }

        for (const tool of report.tools) {
          if (tool.updateAvailable) {
            output.print(
              `${tool.toolId}: Update available: v${tool.updateAvailable.current} -> v${tool.updateAvailable.latest}`
            );
          }
        }
        if (report.docs?.updateAvailable) {
          output.print(
            `docs: Update available: v${report.docs.updateAvailable.current} -> v${report.docs.updateAvailable.latest}`
          );
        }

        if (!report.inSync) {
          output.print("\nLegend: ~ modified  - deleted  + added");
        }
      } catch (error) {
        output.exit(error);
      }
    });
}
