import { homedir } from "node:os";
import { join } from "node:path";

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
  return userConfigDirOf(process.env, homedir());
}
