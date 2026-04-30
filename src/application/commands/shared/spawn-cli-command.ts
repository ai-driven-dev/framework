import { spawn } from "node:child_process";

export function spawnCliCommand(command: string[]): Promise<void> {
  return new Promise((resolve) => {
    spawn(process.execPath, [process.argv[1], ...command], { stdio: "inherit" }).on(
      "close",
      resolve
    );
  });
}
