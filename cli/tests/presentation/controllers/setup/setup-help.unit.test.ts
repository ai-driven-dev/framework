import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { wireTools } from "../../../../src/composition/contexts/tools.js";
import { bindOutput } from "../../../../src/presentation/controllers/menu/global-options.controller.js";
import { registerSetupCommand } from "../../../../src/presentation/controllers/setup/setup.controller.js";
import { globalSetupHelp } from "../../../../src/presentation/controllers/setup/setup-flags.controller.js";
import { processOutputFactory } from "../../../shared/testing/output-factory.builder.js";

const CATALOG = wireTools();
const neverRun = async (): Promise<never> => {
  throw new Error("describing the command runs no setup");
};

describe("aidd setup - the help surface", () => {
  function setupCommand(): Command {
    const program = new Command();
    bindOutput(program, processOutputFactory());
    registerSetupCommand(program, CATALOG, neverRun);
    const setup = program.commands.find((command) => command.name() === "setup");
    if (setup === undefined) throw new Error("setup command was not registered");
    return setup;
  }

  it("says what --global does for each tool, read from its profile", () => {
    expect(globalSetupHelp(wireTools()).split("\n")).toEqual([
      "",
      "Global:",
      "  Pass --ide claude,codex,copilot,cursor,kilo,kimi,opencode (one or more, no editor) and --plugins all, recommended, none or names.",
      "  claude, codex, copilot enable the plugins through their own CLI, which must be on PATH.",
      "  kimi install the plugins through their own server, which their CLI starts and which must be on PATH.",
      "  codex gets their files in ~/.codex, cursor gets their files in ~/.cursor/plugins/local, kilo gets their files in ~/.config/kilo, opencode gets their files in ~/.config/opencode.",
      "  `aidd sync --global` refreshes them from the framework source.",
    ]);
  });

  it("describes itself against the command that acts on the framework alone", () => {
    expect(setupCommand().description()).toBe(
      "Set up or update the project to a correct state — bootstraps the whole project (marketplace, framework, tools, plugins); see `framework install`, which acts on the framework alone"
    );
  });

  it("offers a source, one tool list, a plugin mode, a scope, a provider, an agents-only switch, and its switches", () => {
    const visible = setupCommand().options.filter((option) => !option.hidden);
    expect(visible.map((option) => [option.flags, option.description])).toEqual([
      ["--source <mode>", "Framework source: remote or local"],
      ["--path <dir>", "Absolute path to local framework (required with --source local)"],
      ["--release <tag>", "Marketplace release tag to fetch (e.g., v1.2.3)"],
      ["--ide <ids>", "Comma-separated tool IDs, or 'all' (e.g., claude,vscode or all)"],
      ["--plugins <mode>", "Plugin install mode: none | all | recommended | comma-separated names"],
      [
        "--no-default-marketplace",
        "Skip auto-registering aidd-framework (no source prompt, no plugin install)",
      ],
      ["--yes", "Accept defaults without prompting"],
      [
        "--global",
        "install for every project on this machine instead of into this project; see the " +
          "requirements below",
      ],
      [
        "--provider <provider>",
        "Run each tool's main session and agents on this provider's model for their role (openai, anthropic, mistral), or none for the IDE's model",
      ],
      [
        "--agents-only",
        "Update the agents' models without changing the main session's settings; without --provider, each tool keeps its saved provider",
      ],
    ]);
    expect(
      setupCommand()
        .options.filter((option) => option.hidden)
        .map((option) => option.flags)
    ).toEqual(["--ai <ids>", "--scope <scope>"]);
  });
});
