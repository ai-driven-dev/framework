import type { Command } from "commander";
import type { SelfUpdate } from "../../contexts/update/application/self-update.use-case.js";
import { printSelfUpdateResult } from "../presenters/update.presenter.js";
import { type ContainerFactory, parseGlobalOptions } from "./menu/global-options.controller.js";

/** What this command reads of the container. */
export interface UpdateContainer {
  update: { selfUpdate: Pick<SelfUpdate, "execute"> };
}

type Factory = ContainerFactory<UpdateContainer>;

interface UpdateCmdOptions {
  check: boolean;
  dryRun: boolean;
  force: boolean;
}

/** A bare verb with no subject means the CLI itself, the convention Claude Code and Codex
 * share. The project-wide sweep lives at `framework update`, `plugin update` and
 * `marketplace refresh`. */
async function runUpdateAction(
  program: Command,
  containerOf: Factory,
  cmdOptions: UpdateCmdOptions
): Promise<void> {
  const { verbose, output, projectRoot } = parseGlobalOptions(program);

  const container = await containerOf(projectRoot, { verbose }, output);

  const result = await container.update.selfUpdate.execute({
    check: cmdOptions.check,
    dryRun: cmdOptions.dryRun,
    force: cmdOptions.force,
  });

  printSelfUpdateResult(output, result);
}

export function registerUpdateCommand(program: Command, containerOf: Factory): void {
  program
    .command("update")
    .alias("upgrade")
    .description("Update the aidd CLI itself to the latest version")
    .option("--check", "Check if a newer version is available without installing", false)
    .option("--dry-run", "Preview the update without installing", false)
    .option("-f, --force", "Reinstall even if already up to date", false)
    .action(async (cmdOptions: UpdateCmdOptions) => {
      await runUpdateAction(program, containerOf, cmdOptions);
    });
}
