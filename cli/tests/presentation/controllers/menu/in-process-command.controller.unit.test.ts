import type { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { bindOutput } from "../../../../src/presentation/controllers/menu/global-options.controller.js";
import { inProcessCommand } from "../../../../src/presentation/controllers/menu/in-process-command.controller.js";
import { describeMessage } from "../../../../src/presentation/errors/describe-message.presenter.js";
import { OutputAdapter } from "../../../../src/presentation/terminal/output.adapter.js";

let stderr: string[];
let spies: MockInstance[];
const seen: Array<boolean | undefined> = [];

beforeEach(() => {
  stderr = [];
  seen.length = 0;
  spies = [
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      stderr.push(String(chunk));
      return true;
    }),
    vi.spyOn(process.stdout, "write").mockImplementation(() => true),
  ];
});

afterEach(() => {
  for (const spy of spies) spy.mockRestore();
});

/** A program of three commands, each ending its run one way. */
function register(program: Command, end: (code: number) => never): void {
  bindOutput(program, (verbose) => new OutputAdapter(verbose, end, String, describeMessage));
  program
    .command("echo")
    .option("--loud")
    .action((options: { loud?: boolean }) => {
      seen.push(options.loud);
    });
  program.command("stop").action(() => end(3));
  program.command("throw").action(() => {
    throw new Error("broke");
  });
}

const run = inProcessCommand(register);

describe("running a command of the CLI in this process", () => {
  it("sees only the options its own run was given", async () => {
    await run(["echo", "--loud"]);
    await run(["echo"]);

    expect(seen).toEqual([true, undefined]);
  });

  it("answers the code a command ends with, and the next run starts from success", async () => {
    expect(await run(["stop"])).toBe(3);
    expect(await run(["echo"])).toBe(0);
  });

  it("reports a thrown error once and answers 1", async () => {
    expect(await run(["throw"])).toBe(1);

    expect(stderr).toEqual(["Error: broke\n"]);
  });

  it("answers the parser's code for an unknown command, printing only the parser's error", async () => {
    expect(await run(["nope"])).toBe(1);

    expect(stderr).toEqual(["error: unknown command 'nope'\n"]);
  });
});
