import type { Command } from "commander";
import { assertValidToolIds, type ToolId } from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { InputRequiredError } from "../errors.js";
import type { CLIOutput } from "../output.js";
import { StatusUseCase } from "../use-cases/status-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

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
    .option("--docs", "Filter output to docs only")
    .action(async (cmdOptions: { tool?: string; docs?: boolean }) => {
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      try {
        const deps = await createDeps(projectRoot, { verbose, repo }, output);

        if (cmdOptions.tool !== undefined && cmdOptions.docs) {
          throw new InputRequiredError("--tool and --docs are mutually exclusive");
        }
        if (cmdOptions.tool !== undefined) assertValidToolIds([cmdOptions.tool]);
        const filterToolId = cmdOptions.tool as ToolId | undefined;
        const filterDocs = cmdOptions.docs ?? false;

        const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger);
        const report = await useCase.execute({
          projectRoot,
          filterToolId,
          filterDocs,
          repo,
        });

        if (report.tools.length === 0 && !filterToolId && !filterDocs) {
          output.print("No tools installed. Run `aidd install <tool>` to get started.");
          if (report.inSync) return;
        } else if (report.inSync) {
          output.success("All files are in sync");
          return;
        }

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

        output.print("\nLegend: ~ modified  - deleted  + added");
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
