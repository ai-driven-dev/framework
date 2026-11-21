import { platform } from "node:os";
import { Command } from "commander";
import { createContainer } from "./composition/container.js";
import { bindContainer } from "./composition/orchestration/deps-graph.js";
import { createOutput as createOutputWith } from "./composition/shared.js";
import { wireTelemetryRequests } from "./composition/telemetry.js";
import { wireTools } from "./composition/tools.js";
import { outputOf } from "./presentation/commands/global-options.js";
import { runMenuLoop } from "./presentation/commands/menu.js";
import { registerCommands } from "./presentation/commands/register-commands.js";
import { describeMessage } from "./presentation/errors/describe-message.presenter.js";
import { describeCause, failCommand } from "./presentation/errors/error-translator.presenter.js";
import { registerUpdateNoticeHooks } from "./presentation/hooks/update-notice-hooks.js";
import { spawnCliCommand } from "./presentation/terminal/child-command.js";
import { resolveProjectRoot } from "./presentation/terminal/project-root.js";
import { waitForEnter } from "./presentation/terminal/wait-for-enter.js";

function formatVersion(version: string): string {
  return `aidd/${version} node/${process.versions.node} ${platform()}-${process.arch}`;
}

const tools = wireTools();
const createOutput = (verbose: boolean) =>
  createOutputWith(verbose, describeCause, describeMessage);

// The composition edge: commands receive these factories and never import the wiring.
const version = createContainer({ projectRoot: process.cwd(), verbose: false, tools }).shared
  .version;
const createSlice = bindContainer(tools);
const terminal = { runner: { run: spawnCliCommand }, pause: { untilEnter: waitForEnter } };
const menuOfProject = (projectRoot: string) =>
  createContainer({ projectRoot, verbose: false, tools, output: createOutput(false) }).menu(
    terminal
  );

const program = new Command();

program
  .name("aidd")
  .description("Generate AI coding assistant configurations from the AIDD framework")
  .version(formatVersion(version), "-V, --version", "Show version number")
  .option("--verbose", "Show detailed diagnostic output", false);

registerCommands(program, {
  tools,
  createSlice,
  telemetryRequests: wireTelemetryRequests(),
  runCommand: spawnCliCommand,
  createOutput,
});
registerUpdateNoticeHooks(program, createSlice);

// A reader that stops reading (`aidd … | head -1`) closes stdout under the run: what is left to
// print has nobody to read it, so the run goes on without it and exits on its own outcome.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code !== "EPIPE") throw error;
});

const cliArgs = process.argv.slice(2);

if (cliArgs.length === 0 && process.stdout.isTTY) {
  runMenuLoop(menuOfProject, resolveProjectRoot(), createOutput(false)).catch((error: unknown) =>
    failCommand(outputOf(program), error)
  );
} else {
  program.parseAsync(process.argv).catch((error: unknown) => failCommand(outputOf(program), error));
}
