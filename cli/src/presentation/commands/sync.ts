import type { Command } from "commander";
import type { DepsSliceFactory } from "../../orchestration/deps.js";
import {
  printActivationOutcome,
  printRestoreOutcome,
  printToolRestoreOutcome,
  printUserScopeSyncOutcome,
} from "../display/sync-display.js";
import { GLOBAL_FLAG_HELP, parseGlobalOptions, resolveScopeFlags } from "./global-options.js";

/** What this command reads of the graph. */
type SyncKeys = "runSync" | "runUserScopeSync";

interface SyncCmdOptions {
  force: boolean;
  tool?: string;
  plugin?: string;
  scope?: string;
  global?: boolean;
}

async function runSyncAction({
  program,
  createDeps,
  fileArgs,
  cmdOptions,
}: {
  program: Command;
  createDeps: DepsSliceFactory<SyncKeys>;
  fileArgs: string[];
  cmdOptions: SyncCmdOptions;
}): Promise<void> {
  const { verbose, output, projectRoot } = parseGlobalOptions(program);
  const deps = await createDeps(projectRoot, { verbose }, output);
  const scope = resolveScopeFlags(cmdOptions, output) ?? "project";
  const { tool, plugin, force } = cmdOptions;

  if (scope === "user") {
    await deps.runUserScopeSync.execute(
      { projectRoot, tool, plugin, files: fileArgs },
      {
        activated: (activation) => printActivationOutcome(output, activation),
        synced: ({ activated, refreshed }) =>
          printUserScopeSyncOutcome(output, activated, refreshed),
      }
    );
    return;
  }

  await deps.runSync.execute(
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
  createDeps: DepsSliceFactory<SyncKeys>
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
      await runSyncAction({ program, createDeps, fileArgs, cmdOptions });
    });
}
