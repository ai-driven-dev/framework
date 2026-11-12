import type { Command } from "commander";
import { createDeps } from "../../runtime/wiring/framework.js";
import { printProjectCleanOutcome, printUserScopeCleanOutcome } from "../display/clean-display.js";
import { ErrorHandler } from "../error-handler.js";
import type { CLIOutput } from "../output.js";
import { GLOBAL_FLAG_HELP, parseGlobalOptions, resolveScopeFlags } from "./global-options.js";

type Deps = Awaited<ReturnType<typeof createDeps>>;

interface CleanCmdOptions {
  force: boolean;
  scope?: string;
  global?: boolean;
}

async function runProjectScopeClean(
  deps: Deps,
  output: CLIOutput,
  projectRoot: string,
  cmdOptions: CleanCmdOptions
): Promise<void> {
  const interactive = process.stdout.isTTY === true;
  const result = await deps.cleanUseCase.execute({
    projectRoot,
    force: cmdOptions.force,
    interactive,
  });

  printProjectCleanOutcome(output, result, interactive);
}

async function runUserScopeClean(
  deps: Deps,
  output: CLIOutput,
  projectRoot: string,
  cmdOptions: CleanCmdOptions
): Promise<void> {
  const interactive = process.stdout.isTTY === true;
  const result = await deps.cleanUserScopeUseCase.execute({
    projectRoot,
    force: cmdOptions.force,
    interactive,
  });

  printUserScopeCleanOutcome(output, result, interactive);

  // The agents' provider and the main sessions' models are machine-wide choices too, undone
  // exactly when the clean itself ran: --force, or a confirmed prompt.
  const models = await deps.setAgentModelUseCase.reset({ dryRun: result.dryRun });
  const verb = result.dryRun ? "would be restored" : "restored";
  for (const { host, path } of models.changed)
    output.info(`${host} main session: ${verb} in ${path}`);
  for (const { host, path, reason } of models.skipped) {
    output.warn(`${host} main session left as it is in ${path}: ${reason}.`);
  }
  if (models.providers.length > 0) {
    const forgotten = result.dryRun ? "would be forgotten" : "forgotten";
    output.info(`Agents' provider for ${models.providers.join(", ")}: ${forgotten}.`);
  }
}

export function registerCleanCommand(program: Command): void {
  program
    .command("clean")
    .description(
      "Remove all AIDD-managed files from the project — retires every part of AIDD; see `framework remove`, which removes the framework only"
    )
    .option("--force", "Confirm file removal (skip dry-run)", false)
    .option(
      "--scope <scope>",
      "project (default) cleans this project alone; user undoes the machine-wide " +
        "registration setup --scope user wrote and purges the shared source itself"
    )
    .option("--global", `${GLOBAL_FLAG_HELP}, and purge the shared source`)
    .action(async (cmdOptions: CleanCmdOptions) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      const scope = resolveScopeFlags(cmdOptions, output) ?? "project";

      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        if (scope === "user") {
          await runUserScopeClean(deps, output, projectRoot, cmdOptions);
        } else {
          await runProjectScopeClean(deps, output, projectRoot, cmdOptions);
        }
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
