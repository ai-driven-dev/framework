import { platform } from "node:os";
import { Command } from "commander";
import { printUpdateBanner } from "./application/check-update.js";
import { registerAdoptCommand } from "./application/commands/adopt.js";
import { registerCacheCommand } from "./application/commands/cache.js";
import { registerCleanCommand } from "./application/commands/clean.js";
import { registerConfigCommand } from "./application/commands/config.js";
import { registerDoctorCommand } from "./application/commands/doctor.js";
import { registerInitCommand } from "./application/commands/init.js";
import { registerInstallCommand } from "./application/commands/install.js";
import { registerRestoreCommand } from "./application/commands/restore.js";
import { registerSelfUpdateCommand } from "./application/commands/self-update.js";
import { registerStatusCommand } from "./application/commands/status.js";
import { registerSyncCommand } from "./application/commands/sync.js";
import { registerUninstallCommand } from "./application/commands/uninstall.js";
import { registerUpdateCommand } from "./application/commands/update.js";
import { CLIOutput } from "./application/output.js";
import { CurrentVersionAdapter } from "./infrastructure/adapters/current-version-adapter.js";
import { createDeps } from "./infrastructure/deps.js";

function printBanner(): void {
  if (!process.stdout.isTTY) return;
  process.stdout.write(`
  █████╗ ██╗██████╗ ██████╗
 ██╔══██╗██║██╔══██╗██╔══██╗
 ███████║██║██║  ██║██║  ██║
 ██╔══██║██║██║  ██║██║  ██║
 ██║  ██║██║██████╔╝██████╔╝
 ╚═╝  ╚═╝╚═╝╚═════╝ ╚═════╝

 AI-Driven Development CLI
\n`);
}

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
  .option("--repo <owner/repo>", "GitHub repository in owner/repo format")
  .option("--token <token>", "GitHub authentication token")
  .option("--framework <path>", "Path to a local framework directory or tarball")
  .option("--release <tag>", "Specific framework release tag to install (e.g., v3.2.0)");

registerAdoptCommand(program);
registerCacheCommand(program);
registerConfigCommand(program);
registerInitCommand(program);
registerInstallCommand(program);
registerUninstallCommand(program);
registerStatusCommand(program);
registerCleanCommand(program);
registerDoctorCommand(program);
registerUpdateCommand(program);
registerRestoreCommand(program);
registerSyncCommand(program);
registerSelfUpdateCommand(program);

program.hook("preAction", async () => {
  const opts = program.opts<{ verbose?: boolean; repo?: string; token?: string }>();
  const output = new CLIOutput(opts.verbose ?? false);
  const deps = await createDeps(
    process.cwd(),
    { verbose: opts.verbose ?? false, repo: opts.repo, token: opts.token },
    output
  ).catch(() => null);
  if (deps)
    await printUpdateBanner(
      deps.cliUpdater,
      deps.currentVersionProvider,
      deps.resolver,
      deps.manifestRepo,
      output
    );
});

if (process.argv.slice(2).length === 0) {
  printBanner();
}

program.parse(process.argv);
