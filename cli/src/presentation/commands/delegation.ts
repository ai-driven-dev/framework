import type { Command } from "commander";
import { resolveHomeDir } from "../../kernel/reading/home-dir.js";
import { createDeps } from "../../runtime/wiring/framework.js";
import { ErrorHandler } from "../error-handler.js";
import { parseGlobalOptions } from "./global-options.js";

export function registerDelegationCommand(program: Command): void {
  program
    .command("delegation")
    .description("Read this project's delegation suggestions")
    .command("resolve <task>")
    .description("Resolve a configured role and native options against an installed agent")
    .requiredOption("--tool <id>", "AI tool whose installed agent and native options to resolve")
    .option("--json", "Print the resolution as JSON")
    .action(async (task: string, options: { tool: string; json?: boolean }) => {
      const { projectRoot, verbose, output } = parseGlobalOptions(program);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const result = await deps.resolveDelegationUseCase.execute({
          projectRoot,
          home: resolveHomeDir(),
          env: process.env,
          task,
          tool: options.tool,
        });
        if (options.json) output.print(JSON.stringify(result, null, 2));
        else {
          if (result.agent === undefined)
            output.print(
              `No configured suggestion for ${task}; the caller keeps its role and native settings.`
            );
          else {
            output.print(`Agent: ${result.agent.name} (${result.agent.path})`);
            output.print(`Requested: ${JSON.stringify(result.requested)}`);
            output.print(
              `Native suggestion (${result.nativeSurface}): ${JSON.stringify(result.native)}`
            );
            for (const diagnostic of result.diagnostics) output.warn(diagnostic);
          }
          output.print("Unspecified settings inherit. Effective runtime: unknown.");
        }
      } catch (error) {
        new ErrorHandler(output).handle(error);
      }
    });
}
