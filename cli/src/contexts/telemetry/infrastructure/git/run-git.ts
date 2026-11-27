import { spawnSync } from "node:child_process";

export interface GitRun {
  readonly status: number;
  readonly stdout: string;
}

/** One git call: an argument list, never a shell line, in `cwd`, under an environment the
 * caller has already cleared of git's own variables. A git that cannot be started is thrown;
 * one that answers with a failure is a result, for the caller to read. */
export function runGit(env: NodeJS.ProcessEnv, cwd: string, args: readonly string[]): GitRun {
  const result = spawnSync("git", [...args], {
    cwd,
    env,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (result.error !== undefined) {
    throw new Error(`git could not be run in ${cwd}: ${result.error.message}`);
  }
  return { status: result.status ?? 1, stdout: result.stdout };
}
