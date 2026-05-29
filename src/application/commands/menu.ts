import readline from "node:readline";
import { createMenuDeps } from "../../infrastructure/deps.js";
import { resolveProjectRoot } from "../../infrastructure/project-root.js";
import { InteractiveMenuUseCase } from "../use-cases/menu-use-case.js";
import { spawnCliCommand } from "./shared/spawn-cli-command.js";

async function waitForEnter(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((resolve) => {
    rl.question("\nPress ENTER to continue...", () => {
      rl.close();
      resolve();
    });
  });
}

const BANNER = `
   _    ___ ___  ___
  /_\\  |_ _|   \\|   \\
 / _ \\  | || |) | |) |
/_/ \\_\\|___|___/|___/

 AI-Driven Development CLI
`;

function printBanner(): void {
  process.stdout.write(BANNER);
}

export async function runMenuLoop(): Promise<never> {
  printBanner();
  const { manifestRepo, prompter } = createMenuDeps(resolveProjectRoot());
  for (;;) {
    try {
      const result = await new InteractiveMenuUseCase(manifestRepo, prompter).execute();
      if (result.command[0] === "exit") process.exit(0);
      const exitCode = await spawnCliCommand(result.command);
      await waitForEnter();
      if (exitCode !== 0 && result.command[0] === "setup") process.exit(exitCode);
    } catch (error) {
      if (error instanceof Error && error.name === "ExitPromptError") process.exit(0);
    }
  }
}
