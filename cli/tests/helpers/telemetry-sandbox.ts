import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { initRepository, sandboxGitEnv } from "./git-sandbox.js";

/** A throwaway machine: a home, a telemetry directory, a Claude profile and repositories, all
 * under the operating system's temporary directory. `forget` deletes, so every path it can be
 * pointed at is checked to be inside that directory before any test runs it. */
export interface TelemetrySandbox {
  readonly root: string;
  readonly home: string;
  readonly telemetry: string;
  readonly claude: string;
  readonly gitEnv: NodeJS.ProcessEnv;
  /** A repository on `main`, with an origin of its own. */
  repository(name: string): string;
  /** The environment a CLI run gets: no variable of the real machine reaches it. */
  env(extra?: Record<string, string>): Record<string, string>;
}

export function assertUnderTemporaryDirectory(paths: readonly string[]): void {
  const base = realpathSync(tmpdir());
  for (const path of paths) {
    const inside = relative(base, path);
    if (
      inside === "" ||
      inside.startsWith("..") ||
      inside.startsWith(sep) ||
      /^[a-z]:/i.test(inside)
    ) {
      throw new Error(`${path} is not under ${base}: refusing to run a command that deletes`);
    }
  }
}

export function createTelemetrySandbox(): TelemetrySandbox {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "aidd-telemetry-sandbox-")));
  const home = join(root, "home");
  const telemetry = join(root, "telemetry-dir");
  const claude = join(root, "claude-config");
  for (const dir of [home, claude]) mkdirSync(dir, { recursive: true });
  assertUnderTemporaryDirectory([root, home, telemetry, claude]);
  writeFileSync(join(home, ".gitconfig"), "");
  const gitEnv = sandboxGitEnv(home, { GIT_CONFIG_GLOBAL: join(home, ".gitconfig") });
  return {
    root,
    home,
    telemetry,
    claude,
    gitEnv,
    repository(name) {
      const dir = join(root, name);
      initRepository(dir, gitEnv, { remote: `git@github.com:acme/${name}.git` });
      assertUnderTemporaryDirectory([dir]);
      return dir;
    },
    env(extra = {}) {
      return {
        AIDD_TELEMETRY_DIR: telemetry,
        AIDD_USER_CONFIG_DIR: join(home, ".config", "aidd"),
        HOME: home,
        XDG_CONFIG_HOME: join(home, ".config"),
        APPDATA: join(home, "AppData", "Roaming"),
        USERPROFILE: home,
        CLAUDE_CONFIG_DIR: claude,
        AIDD_TELEMETRY: "",
        CLAUDE_CODE_SESSION_ID: "",
        CODEX_THREAD_ID: "",
        ...extra,
      };
    },
  };
}
