import { join } from "node:path";

export interface LegacyLocations {
  /** The directories the previous version wrote one `YYYY-MM-DD.jsonl` a day into. */
  readonly sinkDirs: readonly string[];
  /** Where it kept the identity it minted. */
  readonly identityFiles: readonly string[];
}

/** A day file's name, and nothing the ledger names its partitions by. */
export const DAY_FILE = /^\d{4}-\d{2}-\d{2}\.jsonl$/;

function set(value: string | undefined): string | null {
  return value !== undefined && value !== "" ? value : null;
}

/** Every place the previous version could have written, whichever of its rules applied on the
 * machine it ran on. It ignored `XDG_CONFIG_HOME`, so `~/.config/aidd` is named outright. */
export function legacyLocations(
  env: NodeJS.ProcessEnv,
  home: string,
  platform: NodeJS.Platform,
  telemetryDir: string
): LegacyLocations {
  const config = join(home, ".config", "aidd");
  const appData = platform === "win32" ? set(env.APPDATA) : null;
  const userConfig = set(env.AIDD_USER_CONFIG_DIR);
  const sinks = [
    telemetryDir,
    set(env.AIDD_TELEMETRY_DIR),
    userConfig === null ? null : join(userConfig, "telemetry"),
    appData === null ? null : join(appData, "aidd", "telemetry"),
    join(config, "telemetry"),
  ];
  const identities = [
    appData === null ? null : join(appData, "aidd", "identity.json"),
    join(config, "identity.json"),
  ];
  return {
    sinkDirs: unique(sinks),
    identityFiles: unique(identities),
  };
}

function unique(paths: readonly (string | null)[]): string[] {
  return [...new Set(paths.filter((path): path is string => path !== null))];
}
