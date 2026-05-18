import type { Command } from "commander";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import type { CLIOutput } from "../output.js";
import { StatusAllUseCase } from "../use-cases/global/status-all-use-case.js";
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
    .description("Show drift across all installed tools and plugins")
    .action(async () => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const useCase = new StatusAllUseCase(deps.fs, deps.manifestRepo, deps.hasher);
        const result = await useCase.execute(projectRoot);

        for (const e of result.errors) output.warn(`[${e.scope}] ${e.message}`);

        const allInSync = result.aiTools.inSync && result.ideTools.inSync && result.plugins.inSync;

        if (allInSync && result.errors.length === 0) {
          output.success("All files are in sync");
          return;
        }

        output.print("\nAI tools:");
        printScopeReport(output, result.aiTools);
        output.print("\nIDE tools:");
        printScopeReport(output, result.ideTools);
        output.print("\nPlugins:");
        printPluginDrift(output, result.plugins);
        output.print("\nLegend: ~ modified  - deleted  + added");
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}

function printScopeReport(
  output: CLIOutput,
  report: {
    tools: {
      toolId: string;
      version: string;
      drifted: { status: string; relativePath: string }[];
    }[];
  }
): void {
  if (report.tools.length === 0) {
    output.print("  (none installed)");
    return;
  }
  for (const tool of report.tools) {
    if (tool.drifted.length === 0) {
      output.print(`  ${tool.toolId} (v${tool.version}): in sync`);
      continue;
    }
    output.print(`  ${tool.toolId} (v${tool.version}):`);
    for (const file of tool.drifted) {
      output.print(`    ${STATUS_SYMBOL[file.status] ?? "?"} ${file.relativePath}`);
    }
    printDriftStats(output, tool.drifted);
  }
}

function printPluginDrift(
  output: CLIOutput,
  report: { pluginDrift: { pluginName: string; toolId: string; driftedFiles: string[] }[] }
): void {
  if (report.pluginDrift.length === 0) {
    output.print("  (all in sync)");
    return;
  }
  for (const entry of report.pluginDrift) {
    output.print(`  plugin ${entry.pluginName} (${entry.toolId}):`);
    for (const f of entry.driftedFiles) {
      output.print(`    ~ ${f}`);
    }
  }
}
