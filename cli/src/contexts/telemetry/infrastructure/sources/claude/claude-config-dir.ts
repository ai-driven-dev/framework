import { join } from "node:path";

/** The directory holding Claude Code's own configuration. `configDir` is `CLAUDE_CONFIG_DIR`. */
export function claudeConfigDir(configDir: string | undefined, home: string): string {
  return configDir === undefined || configDir === "" ? join(home, ".claude") : configDir;
}

/** The directory holding every Claude Code transcript. */
export function claudeProjectsRoot(configDir: string | undefined, home: string): string {
  return join(claudeConfigDir(configDir, home), "projects");
}
