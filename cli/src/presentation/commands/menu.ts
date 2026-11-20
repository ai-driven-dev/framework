import type { MenuLoop } from "../../orchestration/menu/menu-loop.js";
import { printBanner } from "../display/menu-display.js";
import { failCommand } from "../errors/error-translator.js";
import { exitWith } from "../exit.js";
import { CLIOutput } from "../output.js";
import { resolveProjectRoot } from "../project-root.js";

/** The name inquirer gives the error it throws when the user hits Ctrl-C at a prompt. */
const USER_ABORT_ERROR_NAME = "ExitPromptError";

export function isUserAbort(error: unknown): boolean {
  return error instanceof Error && error.name === USER_ABORT_ERROR_NAME;
}

export function routeMenuError(error: unknown, output: CLIOutput): never {
  if (isUserAbort(error)) exitWith(0);
  return failCommand(output, error);
}

export async function runMenuLoop(
  menuOf: (projectRoot: string) => Pick<MenuLoop, "execute">
): Promise<never> {
  const output = new CLIOutput();
  printBanner(output);
  const menuLoop = menuOf(resolveProjectRoot());
  const exitCode = await menuLoop
    .execute()
    .catch((error: unknown) => routeMenuError(error, output));
  return exitWith(exitCode);
}
