import type { MenuLoop } from "../../orchestration/menu/menu-loop.js";
import type { Output } from "../deps.js";
import { printBanner } from "../display/menu-display.js";
import { failCommand } from "../errors/error-translator.js";

/** The name inquirer gives the error it throws when the user hits Ctrl-C at a prompt. */
const USER_ABORT_ERROR_NAME = "ExitPromptError";

export function isUserAbort(error: unknown): boolean {
  return error instanceof Error && error.name === USER_ABORT_ERROR_NAME;
}

export function routeMenuError(error: unknown, output: Output): never {
  if (isUserAbort(error)) output.exit(0);
  return failCommand(output, error);
}

export async function runMenuLoop(
  menuOf: (projectRoot: string) => Pick<MenuLoop, "execute">,
  projectRoot: string,
  output: Output
): Promise<never> {
  printBanner(output);
  const menuLoop = menuOf(projectRoot);
  const exitCode = await menuLoop
    .execute()
    .catch((error: unknown) => routeMenuError(error, output));
  return output.exit(exitCode);
}
