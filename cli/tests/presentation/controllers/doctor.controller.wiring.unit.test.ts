import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import { registerDoctorCommand } from "../../../src/presentation/controllers/doctor.controller.js";
import { bindOutput } from "../../../src/presentation/controllers/global-options.controller.js";
import { ExitRequested } from "../../shared/testing/capturing-output.fake.js";
import { doctorHarness } from "../../shared/testing/doctor-command.builder.js";
import { processOutputFactory } from "../../shared/testing/output-factory.builder.js";

const PROJECT_ROOT = process.cwd();
const { doctorAll, createDeps, errors, run, catalog: CATALOG } = doctorHarness();

describe("aidd doctor - how it builds its graph and reports a failure", () => {
  it("builds the graph for this project at this run's verbosity", async () => {
    await run("--verbose");

    expect(vi.mocked(createDeps)).toHaveBeenCalledWith(
      PROJECT_ROOT,
      { verbose: true },
      expect.anything()
    );
  });

  it("names a failed read on stderr and fails the process", async () => {
    doctorAll.mockRejectedValue(new Error("manifest unreadable"));
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run()).rejects.toThrow(ExitRequested);

    expect(errors.join("")).toBe("Error: manifest unreadable\n");
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe("aidd doctor - the help surface", () => {
  function doctorCommand(): Command {
    const program = new Command();
    bindOutput(program, processOutputFactory());
    registerDoctorCommand(program, CATALOG, createDeps);
    const doctor = program.commands.find((command) => command.name() === "doctor");
    if (doctor === undefined) throw new Error("doctor command was not registered");
    return doctor;
  }

  it("describes itself by what it reports on", () => {
    expect(doctorCommand().description()).toBe(
      "Detected and equipped tools, plugins, drift, and problems — across all tools or one"
    );
  });

  it("offers a tool, a plugin and a scope narrowing, and asks nothing else", () => {
    expect(doctorCommand().options.map((option) => [option.flags, option.description])).toEqual([
      ["--tool <tool>", "Limit to a specific AI or IDE tool"],
      ["--plugin <name>", "Limit plugin checks to a specific plugin"],
      [
        "--scope <scope>",
        "project (default) checks this project's own manifest; user checks the " +
          "machine-wide manifest --scope user setup wrote",
      ],
      ["--global", "act on the machine-wide install `setup --global` wrote"],
    ]);
  });
});
