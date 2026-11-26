import type { Command } from "commander";
import type { RunSync } from "../../../orchestration/sync/run-sync.use-case.js";
import type { RunUserScopeSync } from "../../../orchestration/sync/run-user-scope-sync.use-case.js";
import {
  printActivationOutcome,
  printRestoreOutcome,
  printToolRestoreOutcome,
  printUserScopeSyncOutcome,
} from "../../presenters/setup/sync.presenter.js";
import {
  type ContainerFactory,
  GLOBAL_FLAG_HELP,
  parseGlobalOptions,
  resolveScopeFlags,
} from "../menu/global-options.controller.js";

/** What this command reads of the container. */
export interface SyncContainer {
  global: {
    runSync: Pick<RunSync, "execute">;
    runUserScopeSync: Pick<RunUserScopeSync, "execute">;
  };
}

interface SyncCmdOptions {
  force: boolean;
  tool?: string;
  plugin?: string;
  scope?: string;
  global?: boolean;
}

async function runSyncAction({
  program,
  containerOf,
  fileArgs,
  cmdOptions,
}: {
  program: Command;
  containerOf: ContainerFactory<SyncContainer>;
  fileArgs: string[];
  cmdOptions: SyncCmdOptions;
}): Promise<void> {
  const { verbose, output, projectRoot } = parseGlobalOptions(program);
  const container = await containerOf(projectRoot, { verbose }, output);
  const scope = resolveScopeFlags(cmdOptions, output) ?? "project";
  const { tool, plugin, force } = cmdOptions;

  if (scope === "user") {
    await container.global.runUserScopeSync.execute(
      { projectRoot, tool, plugin, files: fileArgs },
      {
        activated: (activation) => printActivationOutcome(output, activation),
        synced: ({ activated, refreshed }) =>
          printUserScopeSyncOutcome(output, activated, refreshed),
      }
    );
    return;
  }

  await container.global.runSync.execute(
    { projectRoot, force, interactive: process.stdout.isTTY, tool, plugin, files: fileArgs },
    {
      restored: (result) => printRestoreOutcome(output, result),
      toolRestored: (result) => printToolRestoreOutcome(output, result),
      activated: (activation) => printActivationOutcome(output, activation),
    }
  );
}

export function registerSyncCommand(
  program: Command,
  containerOf: ContainerFactory<SyncContainer>
): void {
  program
    .command("sync")
    .description(
      "Rewrite owned files from what is already there — regenerate tracked files, driven by the manifest (see `translate`, which converts a source without recording anything)"
    )
    .argument("[files...]", "Limit sync to specific tracked files")
    .option("-f, --force", "Sync without prompting", false)
    .option("--tool <tool>", "Limit sync to a specific tool")
    .option("--plugin <name>", "Limit sync to a specific plugin")
    .option(
      "--scope <scope>",
      "project (default) resolves this project's own manifest; user resolves the " +
        "machine-wide manifest --scope user setup wrote, restoring no project files"
    )
    .option("--global", `${GLOBAL_FLAG_HELP}, rebuilding its files from the framework source`)
    .action(async (fileArgs: string[], cmdOptions: SyncCmdOptions) => {
      await runSyncAction({ program, containerOf, fileArgs, cmdOptions });
    });
}
