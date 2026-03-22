import { platform } from "node:os";
import { Command } from "commander";
import { printUpdateBanner } from "./application/check-update.js";
import { registerAdoptCommand } from "./application/commands/adopt.js";
import { registerAuthCommand } from "./application/commands/auth.js";
import { registerCacheCommand } from "./application/commands/cache.js";
import { registerCleanCommand } from "./application/commands/clean.js";
import { registerConfigCommand } from "./application/commands/config.js";
import { registerDoctorCommand } from "./application/commands/doctor.js";
import { registerInitCommand } from "./application/commands/init.js";
import { registerInstallCommand } from "./application/commands/install.js";
import { registerRestoreCommand } from "./application/commands/restore.js";
import { registerSelfUpdateCommand } from "./application/commands/self-update.js";
import { registerSetupCommand } from "./application/commands/setup.js";
import { registerStatusCommand } from "./application/commands/status.js";
import { registerSyncCommand } from "./application/commands/sync.js";
import { registerUninstallCommand } from "./application/commands/uninstall.js";
import { registerUpdateCommand } from "./application/commands/update.js";
import { CLIOutput } from "./application/output.js";
import { BannerUseCase } from "./application/use-cases/banner-use-case.js";
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
  .option("--verbose", "Show detailed diagnostic output", false)
  .option("--repo <owner/repo>", "GitHub repository in owner/repo format");

registerAdoptCommand(program);
registerAuthCommand(program);
registerCacheCommand(program);
registerConfigCommand(program);
registerInitCommand(program);
registerInstallCommand(program);

// Hide legacy entry points — setup orchestrates these flows now
for (const name of ["adopt", "init"]) {
  const cmd = program.commands.find((c) => c.name() === name) as
    | (Command & { _hidden: boolean })
    | undefined;
  if (cmd) cmd._hidden = true;
}
registerUninstallCommand(program);
registerStatusCommand(program);
registerCleanCommand(program);
registerDoctorCommand(program);
registerUpdateCommand(program);
registerRestoreCommand(program);
registerSyncCommand(program);
registerSelfUpdateCommand(program);
registerSetupCommand(program);

program.hook("preAction", async (_thisCommand, actionCommand) => {
  const opts = program.opts<{ verbose?: boolean; repo?: string }>();
  const output = new CLIOutput(opts.verbose ?? false);
  const deps = await createDeps(
    process.cwd(),
    { verbose: opts.verbose ?? false, repo: opts.repo },
    output
  ).catch(() => null);
  if (deps) {
    const cmd = actionCommand.name();
    await printUpdateBanner(
      deps.cliUpdater,
      deps.currentVersionProvider,
      deps.resolver,
      deps.manifestRepo,
      output,
      cmd === "self-update",
      ["self-update", "update", "setup"].includes(cmd)
    );
  }
});

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  await new BannerUseCase().execute();
}

program.parse(process.argv);
