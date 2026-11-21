import { spawn } from "node:child_process";

/** The program a child command runs: the node binary and the script it was started from. */
export interface ChildLaunch {
  readonly execPath: string;
  readonly entry: string;
}

/** Runs one command of this tool in a child process and answers its exit code. */
export function spawnCliCommand(
  command: string[],
  launch: ChildLaunch = { execPath: process.execPath, entry: process.argv[1] }
): Promise<number> {
  return new Promise((resolve) => {
    spawn(launch.execPath, [launch.entry, ...command], { stdio: "inherit" }).on("close", (code) =>
      resolve(code ?? 0)
    );
  });
}
