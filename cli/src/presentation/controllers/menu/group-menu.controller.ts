import type { Command } from "commander";
import type { ContainerFactory } from "./global-options.controller.js";

/** One thing a person can pick in a command group's menu. */
export interface MenuChoice {
  readonly name: string;
  readonly value: string;
  readonly description?: string;
}

/** Runs another `aidd` command and resolves with its exit code. */
export type RunCommand = (argv: string[]) => Promise<number>;

/** What a group menu reads of the container. */
export interface GroupMenuContainer {
  shared: { prompter: { select(message: string, choices: MenuChoice[]): Promise<string> } };
}

/** What a group offers when run with no subcommand, and how a pick runs. */
interface GroupMenu {
  readonly question: string;
  readonly choices: readonly MenuChoice[];
  readonly containerOf: ContainerFactory<GroupMenuContainer>;
  readonly runCommand: RunCommand;
}

/** On a terminal, asks which subcommand to run and re-runs the program with the pick; off a
 * terminal, prints the group's help rather than asking a question nobody can answer. */
export function offerGroupMenu(group: Command, menu: GroupMenu): void {
  group.action(async () => {
    if (!process.stdout.isTTY) {
      group.help();
      return;
    }
    const { shared } = await menu.containerOf(process.cwd(), { verbose: false }, undefined);
    const choice = await shared.prompter.select(menu.question, [...menu.choices]);
    await menu.runCommand([group.name(), choice]);
  });
}
