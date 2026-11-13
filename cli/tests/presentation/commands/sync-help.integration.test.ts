import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { catalogOf } from "../../contexts/tools/testing/catalog-of.js";

const { registerSyncCommand } = await import("../../../src/presentation/commands/sync.js");

describe("aidd sync — the help surface", () => {
  function syncCommand(): Command {
    const program = new Command();
    registerSyncCommand(program, catalogOf());
    const sync = program.commands.find((command) => command.name() === "sync");
    if (sync === undefined) throw new Error("sync command was not registered");
    return sync;
  }

  it("describes itself against the command that records nothing", () => {
    expect(syncCommand().description()).toBe(
      "Rewrite owned files from what is already there — regenerate tracked files, driven by the manifest (see `translate`, which converts a source without recording anything)"
    );
  });

  it("takes any number of tracked files, none of them required", () => {
    expect(
      syncCommand().registeredArguments.map((argument) => [
        argument.name(),
        argument.required,
        argument.variadic,
        argument.description,
      ])
    ).toEqual([["files", false, true, "Limit sync to specific tracked files"]]);
  });

  it("offers a forced run and three narrowings, and asks nothing else", () => {
    expect(syncCommand().options.map((option) => [option.flags, option.description])).toEqual([
      ["-f, --force", "Sync without prompting"],
      ["--tool <tool>", "Limit sync to a specific tool"],
      ["--plugin <name>", "Limit sync to a specific plugin"],
      [
        "--scope <scope>",
        "project (default) resolves this project's own manifest; user resolves the " +
          "machine-wide manifest --scope user setup wrote, restoring no project files",
      ],
      [
        "--global",
        "act on the machine-wide install `setup --global` wrote, rebuilding its files from the framework source",
      ],
    ]);
  });
});
