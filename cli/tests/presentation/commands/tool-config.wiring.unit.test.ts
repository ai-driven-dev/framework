import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import { bindOutput } from "../../../src/presentation/commands/global-options.js";
import { registerToolConfigCommand } from "../../../src/presentation/commands/tool-config.js";
import { ExitRequested } from "../../shared/testing/capturing-output.fake.js";
import { processOutputFactory } from "../../shared/testing/output-factory.builder.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { toolConfigHarness } from "../../shared/testing/tool-config-command.builder.js";

const PROJECT_ROOT = process.cwd();
const { listInstalledRules, createDeps, errors, run, catalog: CATALOG } = toolConfigHarness();

describe("aidd framework rules", () => {
  it("reads this project's rules and says so when there are none", async () => {
    expect(await run("rules")).toEqual(["No rules installed for any AI tool."]);
    expect(listInstalledRules).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
    });
  });

  it("prints the inventory as text a person reads", async () => {
    listInstalledRules.mockResolvedValue({
      rules: [{ tool: TOOL.claude, path: ".claude/rules/a.md", description: "", paths: undefined }],
    });

    expect(await run("rules")).toEqual([
      "claude  .claude/rules/a.md",
      "  (no description)",
      "  applies to: every file",
    ]);
  });

  it("prints the same inventory as the JSON a program reads", async () => {
    const rules = [
      { tool: TOOL.claude, path: ".claude/rules/a.md", description: "a rule", paths: ["src/**"] },
    ];
    listInstalledRules.mockResolvedValue({ rules });

    expect((await run("rules", "--json")).join("\n")).toBe(JSON.stringify(rules, null, 2));
  });
});

describe("aidd framework — how every subcommand builds its graph and reports a failure", () => {
  it.each([
    ["install", "--tool", "claude"],
    ["remove", "--tool", "claude"],
    ["update"],
    ["rules"],
    ["validate-recipes", "recipe.md"],
  ])("hands %j this run's verbosity, never an empty option set", async (...args) => {
    await run(...args);

    expect(vi.mocked(createDeps)).toHaveBeenCalledWith(
      PROJECT_ROOT,
      { verbose: false },
      expect.anything()
    );
  });

  it("names a failed rules read on stderr and fails the process", async () => {
    listInstalledRules.mockRejectedValue(new Error("manifest unreadable"));
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("rules")).rejects.toThrow(ExitRequested);

    expect(errors.join("")).toBe("Error: manifest unreadable\n");
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe("aidd framework — the help surface", () => {
  function frameworkCommand(): Command {
    const program = new Command();
    bindOutput(program, processOutputFactory());
    registerToolConfigCommand(program, CATALOG, createDeps);
    const framework = program.commands.find((command) => command.name() === "framework");
    if (framework === undefined) throw new Error("framework command was not registered");
    return framework;
  }

  function optionsOf(name: string): [string, string | undefined, boolean][] {
    const child = frameworkCommand().commands.find((candidate) => candidate.name() === name);
    if (child === undefined) throw new Error(`no subcommand ${name}`);
    return child.options.map((option) => [option.flags, option.description, option.mandatory]);
  }

  it("describes the group and every subcommand against the command it is confused with", () => {
    expect(frameworkCommand().description()).toBe(
      "Manage the framework's lifecycle on installed tools"
    );
    expect(
      frameworkCommand().commands.map((command) => [command.name(), command.description()])
    ).toEqual([
      [
        "install",
        "Install a tool's runtime configuration from bundled assets — acts on the framework alone (see `setup`, which bootstraps the whole project)",
      ],
      [
        "remove",
        "Remove a tool's generated configuration files — removes the framework only (see `clean`, which removes all of AIDD)",
      ],
      [
        "update",
        "Re-install tool configs from bundled CLI assets, moving to a new version (all installed tools if --tool is omitted; see `marketplace refresh`, which re-fetches catalogs instead)",
      ],
      ["rules", "List the rules installed in this project, across every AI tool"],
      [
        "validate-recipes",
        "Validate recipe structure, examples, and local links without changing files",
      ],
    ]);
  });

  it("requires a tool of install and remove, and leaves it optional on update", () => {
    expect(optionsOf("install")).toEqual([
      ["--tool <tool>", "AI or IDE tool ID", true],
      ["-f, --force", "Overwrite already-installed tool", false],
      ["--no-plugins", "Skip propagation of already-installed plugins onto the new tool", false],
    ]);
    expect(optionsOf("remove")).toEqual([["--tool <tool>", "AI or IDE tool ID", true]]);
    expect(optionsOf("update")).toEqual([
      ["--tool <tool>", "Limit update to a specific AI or IDE tool", false],
      ["-f, --force", "Overwrite modified files without prompting", false],
    ]);
    expect(optionsOf("rules")).toEqual([["--json", "Print the inventory as JSON", false]]);
  });
});
