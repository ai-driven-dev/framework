import { platform } from "node:os";
import { Command } from "commander";
import { wireTools } from "./composition/tools.js";
import { registerAuthCommand } from "./presentation/commands/auth.js";
import { registerCleanCommand } from "./presentation/commands/clean.js";
import { registerDoctorCommand } from "./presentation/commands/doctor.js";
import { registerFrameworkCommand } from "./presentation/commands/framework.js";
import { registerMarketplaceCommand } from "./presentation/commands/marketplace.js";
import { runMenuLoop } from "./presentation/commands/menu.js";
import { registerPluginCommand } from "./presentation/commands/plugin.js";
import { registerSetupCommand } from "./presentation/commands/setup.js";
import { registerSyncCommand } from "./presentation/commands/sync.js";
import { registerTelemetryCommand } from "./presentation/commands/telemetry.js";
import { registerTranslateCommand } from "./presentation/commands/translate.js";
import { registerUpdateCommand } from "./presentation/commands/update.js";
import { registerUpdateNoticeHooks } from "./presentation/hooks/update-notice-hooks.js";
import { CurrentVersionAdapter } from "./shared/infrastructure/current-version-adapter.js";

function formatVersion(version: string): string {
  return `aidd/${version} node/${process.versions.node} ${platform()}-${process.arch}`;
}

const currentVersion = new CurrentVersionAdapter().get();

const tools = wireTools();

const program = new Command();

program
  .name("aidd")
  .description("Generate AI coding assistant configurations from the AIDD framework")
  .version(formatVersion(currentVersion), "-V, --version", "Show version number")
  .option("--verbose", "Show detailed diagnostic output", false);

registerSetupCommand(program, tools);
registerFrameworkCommand(program, tools);
registerTranslateCommand(program, tools);
registerPluginCommand(program, tools);
registerMarketplaceCommand(program, tools);
registerAuthCommand(program, tools);
registerSyncCommand(program, tools);
registerUpdateCommand(program, tools);
registerDoctorCommand(program, tools);
registerCleanCommand(program, tools);
registerTelemetryCommand(program, tools);

registerUpdateNoticeHooks(program, tools);

// A reader that stops reading (`aidd … | head -1`) closes stdout under the run: what is left to
// print has nobody to read it, so the run goes on without it and exits on its own outcome.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code !== "EPIPE") throw error;
});

const cliArgs = process.argv.slice(2);

if (cliArgs.length === 0 && process.stdout.isTTY) {
  runMenuLoop(tools);
} else {
  program.parse(process.argv);
}
