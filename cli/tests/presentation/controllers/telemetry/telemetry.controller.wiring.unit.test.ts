import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { wireTelemetryRequests } from "../../../../src/composition/contexts/telemetry.js";
import { bindOutput } from "../../../../src/presentation/controllers/menu/global-options.controller.js";
import { registerTelemetryCommand } from "../../../../src/presentation/controllers/telemetry/telemetry.controller.js";
import surface from "../../../golden/snapshots/help/surface.json" with { type: "json" };
import { processOutputFactory } from "../../../shared/testing/output-factory.builder.js";
import {
  createDeps,
  forget,
  ingest,
  installTelemetryIo,
  report,
  run,
  show,
  stderr,
} from "../../../shared/testing/telemetry-command.builder.js";

installTelemetryIo();

describe("the telemetry command surface", () => {
  /** What the built binary prints, captured by the help golden: the one place it is pinned. */
  const golden: { invocation: string; help: string }[] = surface;

  it("prints each subcommand's help as the golden pins it", () => {
    const program = new Command().name("aidd");
    bindOutput(program, processOutputFactory());
    registerTelemetryCommand(program, createDeps, wireTelemetryRequests());
    const telemetry = program.commands.find((command) => command.name() === "telemetry");
    const helps = [telemetry, ...(telemetry?.commands ?? [])].map((command) => ({
      invocation: command === telemetry ? "aidd telemetry" : `aidd telemetry ${command?.name()}`,
      help: command?.helpInformation().trimEnd(),
    }));
    for (const { invocation, help } of helps) {
      expect(help, invocation).toBe(golden.find((entry) => entry.invocation === invocation)?.help);
    }
  });

  it.each([
    [["on", "--yes", "--as", "Ada", "--anonymous"], "--as names you"],
    [["task", "--none", "Name"], "--none declares no task"],
    [["report", "--days", "x"], "days"],
  ])("refuses %s before the graph is built", async (args, message) => {
    createDeps.mockRejectedValueOnce(new Error("graph built"));
    expect(await run(...args)).toBe(1);
    createDeps.mockReset();
    expect(stderr()).toContain(message);
  });

  it.each([
    ["status", () => show],
    ["ingest", () => ingest],
    ["forget", () => forget],
    ["report", () => report],
  ])("says what failed and exits 1 when %s throws", async (name, useCase) => {
    useCase().mockRejectedValue(new Error("disk full"));
    expect(await run(name)).toBe(1);
    expect(stderr()).toContain("disk full");
  });
});
