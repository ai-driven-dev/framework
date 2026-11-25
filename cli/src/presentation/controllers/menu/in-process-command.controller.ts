import { Command, CommanderError } from "commander";
import { failCommand } from "../../errors/error-translator.presenter.js";
import { outputOf } from "./global-options.controller.js";

/** How a command run inside the menu ends: the run stops, the process does not. */
class RunEnded extends Error {
  constructor(readonly exitCode: number) {
    super(`exit ${String(exitCode)}`);
  }
}

function endRun(code: number): never {
  throw new RunEnded(code);
}

/** Whether an error is how the run ended, already reported, rather than a failure to report. */
function endsTheRun(error: unknown): error is RunEnded | CommanderError {
  return error instanceof RunEnded || error instanceof CommanderError;
}

/** Runs one command of this tool in this process and answers its exit code. Every run parses the
 * same program, built on the first run: commander restores its option values before each parse,
 * and a run ends through `end` or a thrown error, never `process.exitCode`, so nothing of one run
 * reaches the next. */
export function inProcessCommand(register: (program: Command, end: typeof endRun) => void) {
  let built: Command | undefined;
  const programOf = (): Command => {
    if (built) return built;
    built = new Command().exitOverride();
    register(built, endRun);
    return built;
  };
  return async (argv: string[]): Promise<number> => {
    const program = programOf();
    try {
      await program.parseAsync(argv, { from: "user" }).catch((error: unknown) => {
        if (endsTheRun(error)) throw error;
        return failCommand(outputOf(program), error);
      });
      return 0;
    } catch (error) {
      if (endsTheRun(error)) return error.exitCode;
      throw error;
    }
  };
}
