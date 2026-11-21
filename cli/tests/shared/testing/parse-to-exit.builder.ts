import { type Command, CommanderError } from "commander";
import { outputOf } from "../../../src/presentation/commands/global-options.js";
import { failCommand } from "../../../src/presentation/errors/error-translator.presenter.js";
import { ExitRequested } from "./capturing-output.fake.js";

/** Parses as `src/cli.ts` does: a command's failure bubbles out of `parseAsync` to the one exit
 * that reports it and ends the run with code 1. What a test makes of an exit (`ExitRequested`)
 * or Commander's own exits under `exitOverride` is not a command's failure and passes through. */
export async function parseToExit(program: Command, argv: readonly string[]): Promise<void> {
  await program.parseAsync([...argv]).catch((error: unknown) => {
    if (error instanceof CommanderError || error instanceof ExitRequested) throw error;
    return failCommand(outputOf(program), error);
  });
}
