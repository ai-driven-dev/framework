import { execFileSync } from "node:child_process";
import { homedir as osHomedir } from "node:os";
import { join } from "node:path";
import type { PrivateStorageHost } from "../shared/infrastructure/private-storage-adapter.js";

/** `HOME` first, because `os.homedir()` never reads it on Windows: a `HOME` set under Git
 * Bash or by a test sandbox is ignored by a bare call there. */
export function homeDirOf(env: NodeJS.ProcessEnv, osHome: string): string {
  return env.HOME || osHome;
}

/** The machine's home directory, read once when a graph is built, so every site naming a
 * tool's session files sees the same directory. */
export function homeDirResolver(): () => string {
  const home = homeDirOf(process.env, osHomedir());
  return () => home;
}

/** What belongs to the user rather than to a project. `AIDD_USER_CONFIG_DIR` overrides it
 * outright, which is how the suites stay out of a real home directory; `XDG_CONFIG_HOME`
 * names a config root a person already chose, honored before the `~/.config` default. An
 * empty variable is an unset one. */
export function userConfigDirOf(
  env: NodeJS.ProcessEnv,
  home: string,
  joinPath: (...parts: string[]) => string = join
): string {
  if (env.AIDD_USER_CONFIG_DIR) return env.AIDD_USER_CONFIG_DIR;
  if (env.XDG_CONFIG_HOME) return joinPath(env.XDG_CONFIG_HOME, "aidd");
  return joinPath(home, ".config", "aidd");
}

export function userConfigDir(): string {
  return userConfigDirOf(process.env, homeDirResolver()());
}

/** What private storage asks of this machine: its platform, its environment and the one command
 * that restricts a Windows directory. */
export const MACHINE_PRIVATE_STORAGE_HOST: PrivateStorageHost = {
  platform: process.platform,
  env: process.env,
  run: (command, args) => {
    execFileSync(command, args, { stdio: ["ignore", "ignore", "pipe"] });
  },
};
