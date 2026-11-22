import type { Command } from "commander";
import type { Deps, DepsSliceFactory } from "../../../orchestration/deps.js";
import type { Output } from "../../../orchestration/domain/output.js";
import {
  printProjectCleanOutcome,
  printUserScopeCleanOutcome,
} from "../../presenters/setup/clean.presenter.js";
import {
  GLOBAL_FLAG_HELP,
  parseGlobalOptions,
  resolveScopeFlags,
} from "../menu/global-options.controller.js";

/** What this command reads of the graph. */
type CleanKeys = "cleanUseCase" | "cleanUserScopeUseCase" | "setAgentModels";

interface CleanCmdOptions {
  force: boolean;
  scope?: string;
  global?: boolean;
}

interface CleanRun {
  deps: Pick<Deps, CleanKeys>;
  output: Output;
  projectRoot: string;
  cmdOptions: CleanCmdOptions;
}

async function runProjectScopeClean({
  deps,
  output,
  projectRoot,
  cmdOptions,
}: CleanRun): Promise<void> {
  const interactive = process.stdout.isTTY === true;
  const result = await deps.cleanUseCase.execute({
    projectRoot,
    force: cmdOptions.force,
    interactive,
  });

  printProjectCleanOutcome(output, result, interactive);
}

async function runUserScopeClean({
  deps,
  output,
  projectRoot,
  cmdOptions,
}: CleanRun): Promise<void> {
  const interactive = process.stdout.isTTY === true;
  const result = await deps.cleanUserScopeUseCase.execute({
    projectRoot,
    force: cmdOptions.force,
    interactive,
  });

  printUserScopeCleanOutcome(output, result, interactive);

  // The agents' provider and the main sessions' models are machine-wide choices too, undone
  // exactly when the clean itself ran: --force, or a confirmed prompt.
  const models = await deps.setAgentModels.reset({ dryRun: result.dryRun });
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

export function registerCleanCommand(
  program: Command,
  createDeps: DepsSliceFactory<CleanKeys>
): void {
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
      const scope = resolveScopeFlags(cmdOptions, output) ?? "project";

      const deps = await createDeps(projectRoot, { verbose }, output);
      if (scope === "user") {
        await runUserScopeClean({ deps, output, projectRoot, cmdOptions });
      } else {
        await runProjectScopeClean({ deps, output, projectRoot, cmdOptions });
      }
    });
}
