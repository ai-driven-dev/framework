import { platform } from "node:os";
import { Command } from "commander";
import { bindCatalog, createMenuDeps as createFrameworkMenuDeps } from "./composition/framework.js";
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
import type { DepsFactory, MenuDepsFactory } from "./presentation/deps.js";
import { registerUpdateNoticeHooks } from "./presentation/hooks/update-notice-hooks.js";
import { CurrentVersionAdapter } from "./shared/infrastructure/current-version-adapter.js";

function formatVersion(version: string): string {
  return `aidd/${version} node/${process.versions.node} ${platform()}-${process.arch}`;
}

const currentVersion = new CurrentVersionAdapter().get();

const tools = wireTools();

// The composition edge: commands receive these factories and never import the wiring.
const createDeps: DepsFactory = bindCatalog(tools);
const createMenuDeps: MenuDepsFactory = (projectRoot) =>
  createFrameworkMenuDeps(projectRoot, tools);

const program = new Command();

program
  .name("aidd")
  .description("Generate AI coding assistant configurations from the AIDD framework")
  .version(formatVersion(currentVersion), "-V, --version", "Show version number")
  .option("--verbose", "Show detailed diagnostic output", false);

registerSetupCommand(program, tools, createDeps);
registerFrameworkCommand(program, tools, createDeps);
registerTranslateCommand(program, tools, createDeps);
registerPluginCommand(program, tools, createDeps, createMenuDeps);
registerMarketplaceCommand(program, tools, createDeps, createMenuDeps);
registerAuthCommand(program, createDeps);
registerSyncCommand(program, tools, createDeps);
registerUpdateCommand(program, createDeps);
registerDoctorCommand(program, tools, createDeps);
registerCleanCommand(program, tools, createDeps);
registerTelemetryCommand(program, createDeps);

registerUpdateNoticeHooks(program, createDeps);

// A reader that stops reading (`aidd … | head -1`) closes stdout under the run: what is left to
// print has nobody to read it, so the run goes on without it and exits on its own outcome.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code !== "EPIPE") throw error;
});

const cliArgs = process.argv.slice(2);

if (cliArgs.length === 0 && process.stdout.isTTY) {
  runMenuLoop(tools, createMenuDeps);
} else {
  program.parse(process.argv);
}
