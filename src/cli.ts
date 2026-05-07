import { platform } from "node:os";
import { Command } from "commander";
import { registerAiCommand } from "./application/commands/ai.js";
import { registerAuthCommand } from "./application/commands/auth.js";
import { registerCleanCommand } from "./application/commands/clean.js";
import { registerDoctorCommand } from "./application/commands/doctor.js";
import { registerIdeCommand } from "./application/commands/ide.js";
import { registerMarketplaceCommand } from "./application/commands/marketplace.js";
import { runMenuLoop } from "./application/commands/menu.js";
import { registerMigrateCommand } from "./application/commands/migrate.js";
import { registerPluginCommand } from "./application/commands/plugin.js";
import { registerRestoreCommand } from "./application/commands/restore.js";
import { registerSelfUpdateCommand } from "./application/commands/self-update.js";
import { registerSetupCommand } from "./application/commands/setup.js";
import { registerStatusCommand } from "./application/commands/status.js";
import { registerSyncCommand } from "./application/commands/sync.js";
import { registerUpdateCommand } from "./application/commands/update.js";
import { CLIOutput } from "./application/output.js";
import { CheckUpdateUseCase } from "./application/use-cases/check-update-use-case.js";
import { CurrentVersionAdapter } from "./infrastructure/adapters/current-version-adapter.js";
import { createDeps } from "./infrastructure/deps.js";

function formatVersion(version: string): string {
  return `aidd/${version} node/${process.versions.node} ${platform()}-${process.arch}`;
}

const currentVersion = new CurrentVersionAdapter().get();

const program = new Command();

program
  .name("aidd")
  .description("Generate AI coding assistant configurations from the AIDD framework")
  .version(formatVersion(currentVersion), "-V, --version", "Show version number")
  .option("--verbose", "Show detailed diagnostic output", false);

registerSetupCommand(program);
registerAiCommand(program);
registerIdeCommand(program);
registerPluginCommand(program);
registerMarketplaceCommand(program);
registerAuthCommand(program);
registerSyncCommand(program);
registerStatusCommand(program);
registerRestoreCommand(program);
registerUpdateCommand(program);
registerDoctorCommand(program);
registerCleanCommand(program);
registerMigrateCommand(program);
registerSelfUpdateCommand(program);

program.hook("preAction", async (_thisCommand, actionCommand) => {
  const opts = program.opts<{ verbose?: boolean }>();
  const output = new CLIOutput(opts.verbose ?? false);
  const deps = await createDeps(process.cwd(), { verbose: opts.verbose ?? false }, output).catch(
    () => null
  );
  if (deps) {
    const cmd = actionCommand.name();
    await new CheckUpdateUseCase(deps.cliUpdater, deps.currentVersionProvider, output).execute({
      skipCliCheck: cmd === "self-update",
    });
  }
});

const cliArgs = process.argv.slice(2);

if (cliArgs.length === 0 && process.stdout.isTTY) {
  runMenuLoop();
} else {
  program.parse(process.argv);
}
