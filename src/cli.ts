import { readFileSync } from "node:fs";
import { platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
import { registerStatusCommand } from "./application/commands/status.js";
import { registerSyncCommand } from "./application/commands/sync.js";
import { registerUninstallCommand } from "./application/commands/uninstall.js";
import { registerUpdateCommand } from "./application/commands/update.js";
import { CLIOutput } from "./application/output.js";
import { createDeps } from "./infrastructure/deps.js";

function formatVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
    return `aidd/${pkg.version} node/${process.versions.node} ${platform()}-${process.arch}`;
  } catch {
    return `aidd/UNKNOWN node/${process.versions.node} ${platform()}-${process.arch}`;
  }
}

const program = new Command();

program
  .name("aidd")
  .description("Generate AI coding assistant configurations from the AIDD framework")
  .version(formatVersion(), "-V, --version", "Show version number")
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

program.hook("preAction", async () => {
  const opts = program.opts<{ verbose?: boolean; repo?: string; token?: string }>();
  const output = new CLIOutput(opts.verbose ?? false);
  const deps = await createDeps(process.cwd(), { verbose: opts.verbose ?? false, repo: opts.repo, token: opts.token }, output).catch(() => null);
  if (deps) await printUpdateBanner(deps.resolver, deps.manifestRepo, output);
});

program.parse(process.argv);
