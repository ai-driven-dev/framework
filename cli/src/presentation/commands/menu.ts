import readline from "node:readline";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { MenuDepsFactory } from "../deps.js";
import { printBanner } from "../display/menu-display.js";
import { failCommand } from "../errors/error-translator.js";
import { exitWith } from "../exit.js";
import { CLIOutput } from "../output.js";
import { resolveProjectRoot } from "../project-root.js";
import { InteractiveMenuUseCase } from "../prompts/menu-use-case.js";
import { spawnCliCommand } from "../terminal/child-command.js";

async function waitForEnter(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((resolve) => {
    rl.question("\nPress ENTER to continue...", () => {
      rl.close();
      resolve();
    });
  });
}

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
  tools: ToolCatalog,
  createMenuDeps: MenuDepsFactory
): Promise<never> {
  const output = new CLIOutput();
  printBanner(output);
  const { manifestRepo, prompter } = createMenuDeps(resolveProjectRoot());
  for (;;) {
    try {
      const result = await new InteractiveMenuUseCase(manifestRepo, prompter, tools).execute();
      if (result.command[0] === "exit") exitWith(0);
      const exitCode = await spawnCliCommand(result.command);
      await waitForEnter();
      if (exitCode !== 0 && result.command[0] === "setup") exitWith(exitCode);
    } catch (error) {
      routeMenuError(error, output);
    }
  }
}
