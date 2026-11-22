import type { Command } from "commander";
import type { CommandRunner, DepsSliceFactory } from "../../../orchestration/deps.js";

/** One thing a person can pick in a command group's menu. */
export interface MenuChoice {
  readonly name: string;
  readonly value: string;
  readonly description?: string;
}

/** What a group offers when run with no subcommand, and how a pick runs. */
interface GroupMenu {
  readonly question: string;
  readonly choices: readonly MenuChoice[];
  readonly createDeps: DepsSliceFactory<"prompter">;
  readonly runCommand: CommandRunner;
}

/** On a terminal, asks which subcommand to run and re-runs the program with the pick; off a
 * terminal, prints the group's help rather than asking a question nobody can answer. */
export function offerGroupMenu(group: Command, menu: GroupMenu): void {
  group.action(async () => {
    if (!process.stdout.isTTY) {
      group.help();
      return;
    }
    const { prompter } = await menu.createDeps(process.cwd(), { verbose: false }, undefined);
    const choice = await prompter.select(menu.question, [...menu.choices]);
    await menu.runCommand([group.name(), choice]);
  });
}
