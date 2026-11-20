import { platform } from "node:os";
import { Command } from "commander";
import { bindContainer, createContainer } from "./composition/container.js";
import { wireTelemetryRequests } from "./composition/telemetry.js";
import { wireTools } from "./composition/tools.js";
import { registerAuthCommand } from "./presentation/commands/auth.js";
import { registerCleanCommand } from "./presentation/commands/clean.js";
import { registerDoctorCommand } from "./presentation/commands/doctor.js";
import { registerMarketplaceCommand } from "./presentation/commands/marketplace.js";
import { runMenuLoop } from "./presentation/commands/menu.js";
import { registerPluginCommand } from "./presentation/commands/plugin.js";
import { registerSetupCommand } from "./presentation/commands/setup.js";
import { registerSyncCommand } from "./presentation/commands/sync.js";
import { registerTelemetryCommand } from "./presentation/commands/telemetry.js";
import { registerToolConfigCommand } from "./presentation/commands/tool-config.js";
import { registerTranslateCommand } from "./presentation/commands/translate.js";
import { registerUpdateCommand } from "./presentation/commands/update.js";
import type { MenuDepsFactory } from "./presentation/deps.js";
import { registerUpdateNoticeHooks } from "./presentation/hooks/update-notice-hooks.js";
import { spawnCliCommand } from "./presentation/terminal/child-command.js";
import { waitForEnter } from "./presentation/terminal/wait-for-enter.js";

function formatVersion(version: string): string {
  return `aidd/${version} node/${process.versions.node} ${platform()}-${process.arch}`;
}

const tools = wireTools();

// The composition edge: commands receive these factories and never import the wiring.
const version = createContainer({ projectRoot: process.cwd(), verbose: false, tools }).shared
  .version;
const createSlice = bindContainer(tools);
const terminal = { runner: { run: spawnCliCommand }, pause: { untilEnter: waitForEnter } };
const createMenuDeps: MenuDepsFactory = (projectRoot) =>
  createContainer({ projectRoot, verbose: false, tools }).menu(terminal);

const program = new Command();

program
  .name("aidd")
  .description("Generate AI coding assistant configurations from the AIDD framework")
  .version(formatVersion(version), "-V, --version", "Show version number")
  .option("--verbose", "Show detailed diagnostic output", false);

registerSetupCommand(program, tools, createSlice);
registerToolConfigCommand(program, tools, createSlice);
registerTranslateCommand(program, tools, createSlice);
registerPluginCommand(program, tools, createSlice, createMenuDeps);
registerMarketplaceCommand(program, createSlice, createMenuDeps);
registerAuthCommand(program, createSlice);
registerSyncCommand(program, tools, createSlice);
registerUpdateCommand(program, createSlice);
registerDoctorCommand(program, tools, createSlice);
registerCleanCommand(program, createSlice);
registerTelemetryCommand(program, createSlice, wireTelemetryRequests());

registerUpdateNoticeHooks(program, createSlice);

// A reader that stops reading (`aidd … | head -1`) closes stdout under the run: what is left to
// print has nobody to read it, so the run goes on without it and exits on its own outcome.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code !== "EPIPE") throw error;
});

const cliArgs = process.argv.slice(2);

if (cliArgs.length === 0 && process.stdout.isTTY) {
  runMenuLoop(createMenuDeps);
} else {
  program.parse(process.argv);
}
