import { Command } from "commander";
import { registerInitCommand } from "./application/commands/init.js";
import { registerInstallCommand } from "./application/commands/install.js";
import { formatVersion } from "./application/output.js";

const program = new Command();

program
  .name("aidd")
  .description("Generate AI coding assistant configurations from the AIDD framework")
  .version(formatVersion(), "-V, --version", "Show version number")
  .option("--verbose", "Show detailed diagnostic output", false)
  .option("--repo <owner/repo>", "GitHub repository in owner/repo format")
  .option("--token <token>", "GitHub authentication token")
  .option("--framework <path>", "Path to a local framework directory or tarball");

registerInitCommand(program);
registerInstallCommand(program);

program.parse(process.argv);
