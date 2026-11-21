import type { Command } from "commander";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { CommandRunner, DepsFactory, TelemetryRequests } from "../deps.js";
import { registerAuthCommand } from "./auth.js";
import { registerCleanCommand } from "./clean.js";
import { registerDoctorCommand } from "./doctor.js";
import { bindOutput, type OutputFactory } from "./global-options.js";
import { registerMarketplaceCommand } from "./marketplace.js";
import { registerPluginCommand } from "./plugin.js";
import { registerSetupCommand } from "./setup.js";
import { registerSyncCommand } from "./sync.js";
import { registerTelemetryCommand } from "./telemetry.js";
import { registerToolConfigCommand } from "./tool-config.js";
import { registerTranslateCommand } from "./translate.js";
import { registerUpdateCommand } from "./update.js";

/** The commands of the binary, in the order `aidd --help` lists them. The binary and the in-process
 * test runner both call it, so a command added here is in both. */
export interface CommandWiring {
  readonly tools: ToolCatalog;
  readonly createSlice: DepsFactory;
  readonly telemetryRequests: TelemetryRequests;
  readonly runCommand: CommandRunner;
  readonly createOutput: OutputFactory;
}

export function registerCommands(
  program: Command,
  { tools, createSlice, telemetryRequests, runCommand, createOutput }: CommandWiring
): void {
  bindOutput(program, createOutput);
  registerSetupCommand(program, tools, createSlice);
  registerToolConfigCommand(program, tools, createSlice);
  registerTranslateCommand(program, tools, createSlice);
  registerPluginCommand(program, { catalog: tools, createDeps: createSlice, runCommand });
  registerMarketplaceCommand(program, createSlice, runCommand);
  registerAuthCommand(program, createSlice);
  registerSyncCommand(program, createSlice);
  registerUpdateCommand(program, createSlice);
  registerDoctorCommand(program, tools, createSlice);
  registerCleanCommand(program, createSlice);
  registerTelemetryCommand(program, createSlice, telemetryRequests);
}
