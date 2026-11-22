import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SelfUpdateResult } from "../../../src/contexts/update/application/self-update.use-case.js";
import { bindOutput } from "../../../src/presentation/controllers/menu/global-options.controller.js";
import { ExitRequested } from "../../shared/testing/capturing-output.fake.js";
import { processOutputFactory } from "../../shared/testing/output-factory.builder.js";
import { parseToExit } from "../../shared/testing/parse-to-exit.builder.js";

const selfUpdate = vi.fn<() => Promise<SelfUpdateResult>>();

const createDeps = vi.fn(async () => ({ selfUpdate: { execute: selfUpdate } }));

const { registerUpdateCommand } = await import(
  "../../../src/presentation/controllers/update.controller.js"
);

const PROJECT_ROOT = process.cwd();

let written: string[] = [];
let errors: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  written = [];
  errors = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    written.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    errors.push(String(chunk));
    return true;
  });
  selfUpdate.mockResolvedValue({ kind: "up-to-date", version: "5.2.2" });
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

async function run(...args: string[]): Promise<string[]> {
  const program = new Command();
  bindOutput(program, processOutputFactory());
  program.exitOverride();
  program.option("--verbose");
  registerUpdateCommand(program, createDeps);
  await parseToExit(program, ["node", "aidd", ...args]);
  return written.join("").split("\n").slice(0, -1);
}

describe("aidd update - what it asks the self-updater", () => {
  it("asks for a real install with every flag off when none was given", async () => {
    expect(await run("update")).toEqual(["Already up to date (5.2.2)"]);
    expect(selfUpdate).toHaveBeenCalledWith({ check: false, dryRun: false, force: false });
  });

  it("asks only for a check, and names the version waiting", async () => {
    selfUpdate.mockResolvedValue({
      kind: "check-available",
      latestVersion: "5.3.0",
      currentVersion: "5.2.2",
    });

    expect(await run("update", "--check")).toEqual([
      "New version available: 5.3.0 (current: 5.2.2)",
    ]);
    expect(selfUpdate).toHaveBeenCalledWith({ check: true, dryRun: false, force: false });
  });

  it("asks for a preview, and names what it would install", async () => {
    selfUpdate.mockResolvedValue({ kind: "dry-run", latestVersion: "5.3.0" });

    expect(await run("update", "--dry-run")).toEqual(["Would install @ai-driven-dev/cli@5.3.0"]);
    expect(selfUpdate).toHaveBeenCalledWith({ check: false, dryRun: true, force: false });
  });

  it("carries a forced reinstall through, and names where the binary landed", async () => {
    selfUpdate.mockResolvedValue({
      kind: "updated",
      latestVersion: "5.3.0",
      changelog: null,
      binaryPath: "/usr/local/bin/aidd",
    });

    expect(await run("update", "--force")).toEqual([
      "Successfully updated to version 5.3.0 (/usr/local/bin/aidd)",
    ]);
    expect(selfUpdate).toHaveBeenCalledWith({ check: false, dryRun: false, force: true });
  });

  it("answers to upgrade as well as to update", async () => {
    expect(await run("upgrade")).toEqual(["Already up to date (5.2.2)"]);
    expect(selfUpdate).toHaveBeenCalledTimes(1);
  });

  it("builds the graph for this project at this run's verbosity", async () => {
    await run("update");

    expect(vi.mocked(createDeps)).toHaveBeenCalledWith(
      PROJECT_ROOT,
      { verbose: false },
      expect.anything()
    );
  });

  it("carries --verbose into the graph it builds", async () => {
    await run("--verbose", "update");

    expect(vi.mocked(createDeps)).toHaveBeenCalledWith(
      PROJECT_ROOT,
      { verbose: true },
      expect.anything()
    );
  });

  it("names the failure on stderr and fails the process", async () => {
    selfUpdate.mockRejectedValue(new Error("registry unreachable"));
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("update")).rejects.toThrow(ExitRequested);

    expect(errors.join("")).toBe("Error: registry unreachable\n");
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe("aidd update - the help surface", () => {
  function updateCommand(): Command {
    const program = new Command();
    bindOutput(program, processOutputFactory());
    registerUpdateCommand(program, createDeps);
    const update = program.commands.find((command) => command.name() === "update");
    if (update === undefined) throw new Error("update command was not registered");
    return update;
  }

  it("describes the command by what it updates, and answers to one alias", () => {
    expect(updateCommand().description()).toBe("Update the aidd CLI itself to the latest version");
    expect(updateCommand().aliases()).toEqual(["upgrade"]);
  });

  it("offers a check, a preview and a reinstall, and asks nothing else", () => {
    expect(updateCommand().options.map((option) => [option.flags, option.description])).toEqual([
      ["--check", "Check if a newer version is available without installing"],
      ["--dry-run", "Preview the update without installing"],
      ["-f, --force", "Reinstall even if already up to date"],
    ]);
  });
});
