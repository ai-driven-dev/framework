import type { BuildMenu } from "./build-menu.js";
import type { CommandRunner, Pause } from "./menu-ports.js";

const EXIT_COMMAND = "exit";
const SETUP_COMMAND = "setup";
const SUCCESS = 0;

/** Offers the menu again after each command, until the person leaves or setup fails. */
export class MenuLoop {
  constructor(
    private readonly menu: Pick<BuildMenu, "execute">,
    private readonly runner: CommandRunner,
    private readonly pause: Pause
  ) {}

  /** The exit code the menu ends with. */
  async execute(): Promise<number> {
    for (;;) {
      const { command } = await this.menu.execute();
      if (command[0] === EXIT_COMMAND) return SUCCESS;
      const exitCode = await this.runner.run(command);
      await this.pause.untilEnter();
      if (exitCode !== SUCCESS && command[0] === SETUP_COMMAND) return exitCode;
    }
  }
}
