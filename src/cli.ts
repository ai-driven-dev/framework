import { readFileSync } from "node:fs";
import { platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { registerCleanCommand } from "./application/commands/clean.js";
import { registerDoctorCommand } from "./application/commands/doctor.js";
import { registerInitCommand } from "./application/commands/init.js";
import { registerInstallCommand } from "./application/commands/install.js";
import { registerStatusCommand } from "./application/commands/status.js";
import { registerUninstallCommand } from "./application/commands/uninstall.js";

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

registerInitCommand(program);
registerInstallCommand(program);
registerUninstallCommand(program);
registerStatusCommand(program);
registerCleanCommand(program);
registerDoctorCommand(program);

program.parse(process.argv);
