import readline from "node:readline";

/** Where the prompt is shown and the answer read. */
export interface EnterStreams {
  readonly input: NodeJS.ReadableStream;
  readonly output: NodeJS.WritableStream;
}

/** Holds the screen until the person presses ENTER. */
export async function waitForEnter(
  streams: EnterStreams = { input: process.stdin, output: process.stdout }
): Promise<void> {
  const rl = readline.createInterface(streams);
  await new Promise<void>((resolve) => {
    rl.question("\nPress ENTER to continue...", () => {
      rl.close();
      resolve();
    });
  });
}
