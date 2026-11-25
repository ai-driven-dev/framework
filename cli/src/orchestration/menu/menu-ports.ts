/** Runs one command of the tool outside the menu and tells how it ended. */
export interface CommandRunner {
  run(argv: string[]): Promise<number>;
}

/** Holds the screen until the person has read what a command printed. */
export interface Pause {
  untilEnter(): Promise<void>;
}
