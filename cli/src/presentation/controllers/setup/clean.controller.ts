import type { Command } from "commander";
import type { ResetAgentModels } from "../../../orchestration/agent-models/reset-agent-models.use-case.js";
import type { CleanProject } from "../../../orchestration/clean/clean-project.use-case.js";
import type { CleanUserScope } from "../../../orchestration/clean/clean-user-scope.use-case.js";
import type { Output } from "../../../orchestration/domain/output.js";
import {
  printProjectCleanOutcome,
  printUserScopeCleanOutcome,
} from "../../presenters/setup/clean.presenter.js";
import {
  type ContainerFactory,
  GLOBAL_FLAG_HELP,
  parseGlobalOptions,
  resolveScopeFlags,
} from "../menu/global-options.controller.js";

/** What this command reads of the container. */
export interface CleanContainer {
  clean: {
    cleanProject: Pick<CleanProject, "execute">;
    cleanUserScope: Pick<CleanUserScope, "execute">;
  };
  agentModels: { resetAgentModels: Pick<ResetAgentModels, "execute"> };
}

interface CleanCmdOptions {
  force: boolean;
  scope?: string;
  global?: boolean;
}

interface CleanRun {
  container: CleanContainer;
  output: Output;
  projectRoot: string;
  cmdOptions: CleanCmdOptions;
}

async function runProjectScopeClean({
  container,
  output,
  projectRoot,
  cmdOptions,
}: CleanRun): Promise<void> {
  const interactive = process.stdout.isTTY === true;
  const result = await container.clean.cleanProject.execute({
    projectRoot,
    force: cmdOptions.force,
    interactive,
  });

  printProjectCleanOutcome(output, result, interactive);
}

async function runUserScopeClean({
  container,
  output,
  projectRoot,
  cmdOptions,
}: CleanRun): Promise<void> {
  const interactive = process.stdout.isTTY === true;
  const result = await container.clean.cleanUserScope.execute({
    projectRoot,
    force: cmdOptions.force,
    interactive,
  });

  printUserScopeCleanOutcome(output, result, interactive);

  // The agents' provider and the main sessions' models are machine-wide choices too, undone
  // exactly when the clean itself ran: --force, or a confirmed prompt.
  const models = await container.agentModels.resetAgentModels.execute({ dryRun: result.dryRun });
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
  containerOf: ContainerFactory<CleanContainer>
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

      const container = await containerOf(projectRoot, { verbose }, output);
      if (scope === "user") {
        await runUserScopeClean({ container, output, projectRoot, cmdOptions });
      } else {
        await runProjectScopeClean({ container, output, projectRoot, cmdOptions });
      }
    });
}
