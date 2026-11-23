import type { Command } from "commander";
import { type AuthContainer, registerAuthCommand } from "../auth.controller.js";
import { registerDoctorCommand } from "../doctor/doctor.controller.js";
import type { DoctorContainer } from "../doctor/doctor-run.controller.js";
import { registerMarketplaceCommand } from "../plugin/marketplace.controller.js";
import type { MarketplaceContainer } from "../plugin/marketplace-add.controller.js";
import { type PluginContainer, registerPluginCommand } from "../plugin/plugin.controller.js";
import type { RecipesContainer } from "../recipes.controller.js";
import { type CleanContainer, registerCleanCommand } from "../setup/clean.controller.js";
import { registerSetupCommand, type SetupContainer } from "../setup/setup.controller.js";
import type { SetupCatalog } from "../setup/setup-flags.controller.js";
import { registerSyncCommand, type SyncContainer } from "../setup/sync.controller.js";
import { registerTelemetryCommand } from "../telemetry/telemetry.controller.js";
import type {
  TelemetryContainer,
  TelemetryRequests,
} from "../telemetry/telemetry-surface.controller.js";
import { registerToolConfigCommand } from "../tools/tool-config.controller.js";
import type { ToolConfigContainer } from "../tools/tool-config-run.controller.js";
import { registerTranslateCommand, type TranslateContainer } from "../translate.controller.js";
import { registerUpdateCommand, type UpdateContainer } from "../update.controller.js";
import {
  bindOutput,
  type ContainerFactory,
  type OutputFactory,
} from "./global-options.controller.js";
import type { RunCommand } from "./group-menu.controller.js";

/** Every context the commands read: the real container carries them all. */
type CommandsContainer = CleanContainer &
  DoctorContainer &
  SetupContainer &
  SyncContainer &
  PluginContainer &
  MarketplaceContainer &
  ToolConfigContainer &
  RecipesContainer &
  TelemetryContainer &
  AuthContainer &
  UpdateContainer &
  TranslateContainer;

/** The commands of the binary, in the order `aidd --help` lists them. The binary and the in-process
 * test runner both call it, so a command added here is in both. */
export interface CommandWiring {
  readonly tools: SetupCatalog;
  readonly containerOf: ContainerFactory<CommandsContainer>;
  readonly telemetryRequests: TelemetryRequests;
  readonly runCommand: RunCommand;
  readonly createOutput: OutputFactory;
}

export function registerCommands(
  program: Command,
  { tools, containerOf, telemetryRequests, runCommand, createOutput }: CommandWiring
): void {
  bindOutput(program, createOutput);
  registerSetupCommand(program, tools, containerOf);
  registerToolConfigCommand(program, tools, containerOf);
  registerTranslateCommand(program, tools, containerOf);
  registerPluginCommand(program, { catalog: tools, containerOf, runCommand });
  registerMarketplaceCommand(program, containerOf, runCommand);
  registerAuthCommand(program, containerOf);
  registerSyncCommand(program, containerOf);
  registerUpdateCommand(program, containerOf);
  registerDoctorCommand(program, tools, containerOf);
  registerCleanCommand(program, containerOf);
  registerTelemetryCommand(program, containerOf, telemetryRequests);
}
