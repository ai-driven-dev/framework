import { Command } from "commander";
import { expect, it } from "vitest";
import { containerFactory } from "../../../../src/composition/container.js";
import { wireTelemetryRequests } from "../../../../src/composition/contexts/telemetry.js";
import { wireTools } from "../../../../src/composition/contexts/tools.js";
import { registerCommands } from "../../../../src/presentation/controllers/menu/register-commands.controller.js";
import { processOutputFactory } from "../../../shared/testing/output-factory.builder.js";

it("registers every command of the binary", () => {
  const tools = wireTools();
  const program = new Command();
  registerCommands(program, {
    tools,
    containerOf: containerFactory(tools),
    telemetryRequests: wireTelemetryRequests(),
    runCommand: async () => 0,
    createOutput: processOutputFactory(),
  });
  expect(program.commands.map((command) => command.name())).toEqual([
    "setup",
    "framework",
    "translate",
    "plugin",
    "marketplace",
    "auth",
    "sync",
    "update",
    "doctor",
    "clean",
    "telemetry",
  ]);
});
