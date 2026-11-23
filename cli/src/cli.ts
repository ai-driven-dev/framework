import { platform } from "node:os";
import { Command } from "commander";
import { containerFactory, createContainer } from "./composition/container.js";
import { wireTelemetryRequests } from "./composition/contexts/telemetry.js";
import { wireTools } from "./composition/contexts/tools.js";
import { bindContainer } from "./composition/orchestration/deps-graph.js";
import { outputEndingWith } from "./composition/shared.js";
import { outputOf } from "./presentation/controllers/menu/global-options.controller.js";
import { inProcessCommand } from "./presentation/controllers/menu/in-process-command.controller.js";
import { runMenuLoop } from "./presentation/controllers/menu/menu.controller.js";
import { registerCommands } from "./presentation/controllers/menu/register-commands.controller.js";
import { describeMessage } from "./presentation/errors/describe-message.presenter.js";
import { describeCause, failCommand } from "./presentation/errors/error-translator.presenter.js";
import { registerUpdateNoticeHooks } from "./presentation/hooks/update-notice-hooks.js";
import { resolveProjectRoot } from "./presentation/terminal/project-root.js";
import { waitForEnter } from "./presentation/terminal/wait-for-enter.js";

function formatVersion(version: string): string {
  return `aidd/${version} node/${process.versions.node} ${platform()}-${process.arch}`;
}

const tools = wireTools();
/** The output a run writes to, worded by the catalogue; `end` is how the run stops. */
const outputOfRun = (end: (code: number) => never) =>
  outputEndingWith(end, describeCause, describeMessage);
const createOutput = outputOfRun((code) => process.exit(code));

// The composition edge: commands receive these factories and never import the wiring.
const version = createContainer({ projectRoot: process.cwd(), verbose: false, tools }).shared
  .currentVersion;
const createSlice = bindContainer(tools);
const containerOf = containerFactory(tools);
const telemetryRequests = wireTelemetryRequests();

/** The binary's program: its options, its commands and its hooks, each run ending through `end`. */
function registerProgram(program: Command, end: (code: number) => never): Command {
  program
    .name("aidd")
    .description("Generate AI coding assistant configurations from the AIDD framework")
    .version(formatVersion(version), "-V, --version", "Show version number")
    .option("--verbose", "Show detailed diagnostic output", false);
  registerCommands(program, {
    tools,
    createSlice,
    containerOf,
    telemetryRequests,
    runCommand: runInMenu,
    createOutput: outputOfRun(end),
  });
  registerUpdateNoticeHooks(program, createSlice);
  return program;
}

/** A command the menu runs: in this process, ending its run rather than the process. */
const runInMenu = inProcessCommand(registerProgram);
const terminal = { runner: { run: runInMenu }, pause: { untilEnter: waitForEnter } };
const menuOfProject = (projectRoot: string) =>
  createContainer({ projectRoot, verbose: false, tools, output: createOutput(false) }).menu(
    terminal
  );

const program = registerProgram(new Command(), (code) => process.exit(code));

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
