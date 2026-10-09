import { join } from "node:path";

/** The directory holding every transcript. `configDir` is `CLAUDE_CONFIG_DIR`; reading the
 * environment is the composition root's job, not the domain's. */
export function claudeProjectsRoot(configDir: string | undefined, home: string): string {
  const base = configDir === undefined || configDir === "" ? join(home, ".claude") : configDir;
  return join(base, "projects");
}
