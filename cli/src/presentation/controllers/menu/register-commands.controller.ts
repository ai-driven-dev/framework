import type { Command } from "commander";
import type { CommandRunner, DepsFactory, TelemetryRequests } from "../../../orchestration/deps.js";
import { registerAuthCommand } from "../auth.controller.js";
import { registerDoctorCommand } from "../doctor/doctor.controller.js";
import { registerMarketplaceCommand } from "../plugin/marketplace.controller.js";
import { registerPluginCommand } from "../plugin/plugin.controller.js";
import { type CleanContainer, registerCleanCommand } from "../setup/clean.controller.js";
import { registerSetupCommand } from "../setup/setup.controller.js";
import type { SetupCatalog } from "../setup/setup-flags.controller.js";
import { registerSyncCommand } from "../setup/sync.controller.js";
import { registerTelemetryCommand } from "../telemetry/telemetry.controller.js";
import { registerToolConfigCommand } from "../tools/tool-config.controller.js";
import { registerTranslateCommand } from "../translate.controller.js";
import { registerUpdateCommand } from "../update.controller.js";
import {
  bindOutput,
  type ContainerFactory,
  type OutputFactory,
} from "./global-options.controller.js";

/** Every context the commands read: the real container carries them all. */
type CommandsContainer = CleanContainer;

/** The commands of the binary, in the order `aidd --help` lists them. The binary and the in-process
 * test runner both call it, so a command added here is in both. */
export interface CommandWiring {
  readonly tools: SetupCatalog;
  readonly createSlice: DepsFactory;
  readonly containerOf: ContainerFactory<CommandsContainer>;
  readonly telemetryRequests: TelemetryRequests;
  readonly runCommand: CommandRunner;
  readonly createOutput: OutputFactory;
}

export function registerCommands(
  program: Command,
  { tools, createSlice, containerOf, telemetryRequests, runCommand, createOutput }: CommandWiring
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
  registerCleanCommand(program, containerOf);
  registerTelemetryCommand(program, createSlice, telemetryRequests);
}
