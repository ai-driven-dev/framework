import type { Command } from "commander";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import type { CLIOutput } from "../output.js";
import { StatusUseCase } from "../use-cases/status-use-case.js";
import { parseCategoryArg, parseGlobalOptions } from "./global-options.js";

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
    .argument("[category]", "Filter to 'ai' or 'ide' tools")
    .option("--docs", "Filter output to docs only")
    .action(async (categoryArg: string | undefined, cmdOptions: { docs?: boolean }) => {
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      const category = parseCategoryArg(categoryArg, output);

      if (category && cmdOptions.docs) {
        output.error("category and --docs are mutually exclusive");
        process.exit(1);
      }

      try {
        const filterDocs = cmdOptions.docs ?? false;

        const deps = await createDeps(projectRoot, { verbose, repo }, output);

        const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger, deps.hasher);
        const report = await useCase.execute({
          projectRoot,
          filterToolId: undefined,
          filterDocs,
          category,
          repo,
        });

        if (report.tools.length === 0 && !filterDocs && !category) {
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
