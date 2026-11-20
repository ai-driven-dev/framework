import { Command } from "commander";
import { expect, it } from "vitest";
import { bindContainer } from "../../../src/composition/container.js";
import { wireTelemetryRequests } from "../../../src/composition/telemetry.js";
import { wireTools } from "../../../src/composition/tools.js";
import { registerCommands } from "../../../src/presentation/commands/register-commands.js";

it("registers every command of the binary", () => {
  const tools = wireTools();
  const program = new Command();
  registerCommands(program, {
    tools,
    createSlice: bindContainer(tools),
    telemetryRequests: wireTelemetryRequests(),
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
