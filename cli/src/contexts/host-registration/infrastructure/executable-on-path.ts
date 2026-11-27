import { accessSync, constants } from "node:fs";
import { pathRulesOf } from "../../../shared/domain/paths.model.js";

/** How long a host's own CLI or server may take to answer: `plugin add` and `install` may fetch and
 * cache a marketplace snapshot from a git remote. */
export const HOST_COMMAND_TIMEOUT_MS = 120000;

/** What resolving a tool's binary on `PATH` needs to know about the machine. Injected so
 * a test can describe a Windows machine from anywhere. */
export interface ExecutableLookup {
  readonly pathEnv: string | undefined;
  readonly pathExt: string | undefined;
  readonly platform: NodeJS.Platform;
  readonly isExecutable: (path: string) => boolean;
}

const DEFAULT_WINDOWS_PATHEXT = ".COM;.EXE;.BAT;.CMD";

/** The file names a bare command can stand for. On Windows a `claude` on `PATH` is
 * `claude.cmd` (an npm shim) or `claude.exe`, never a file named `claude`; every other
 * platform means the bare name. */
export function candidateExecutableNames(
  binary: string,
  platform: NodeJS.Platform,
  pathExt: string | undefined
): readonly string[] {
  if (platform !== "win32") return [binary];
  const exts = (pathExt ?? DEFAULT_WINDOWS_PATHEXT).split(";").filter((ext) => ext !== "");
  // PATHEXT is conventionally upper-case while the shim on disk is `claude.cmd`; the file
  // system there does not care, but a lookup handed a case-sensitive answer must not.
  const spellings = [...new Set(exts.flatMap((ext) => [ext, ext.toLowerCase()]))];
  return [binary, ...spellings.map((ext) => `${binary}${ext}`)];
}

/** The first file on `PATH` the command resolves to, or `undefined` when none does. */
export function resolveExecutableOnPath(
  binary: string,
  lookup: ExecutableLookup
): string | undefined {
  const impl = pathRulesOf(lookup.platform);
  const dirs = (lookup.pathEnv ?? "").split(impl.delimiter).filter((dir) => dir !== "");
  const names = candidateExecutableNames(binary, lookup.platform, lookup.pathExt);
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = impl.join(dir, name);
      if (lookup.isExecutable(candidate)) return candidate;
    }
  }
  return undefined;
}

/** A batch file cannot be spawned directly; Windows runs it through its command
 * interpreter, and node refuses the direct spawn outright. */
export function runsThroughShell(executable: string): boolean {
  return /\.(cmd|bat)$/i.test(executable);
}

/** One command line for `cmd.exe`, each argument quoted when it holds a character the
 * interpreter would otherwise read as its own. */
export function windowsCommandLine(executable: string, args: readonly string[]): string {
  return [executable, ...args].map(quoteForCmd).join(" ");
}

function quoteForCmd(arg: string): string {
  if (arg !== "" && !/[\s"&|<>^()%!]/.test(arg)) return arg;
  return `"${arg.replaceAll('"', '""')}"`;
}

export function hostExecutableLookup(): ExecutableLookup {
  return {
    pathEnv: process.env.PATH,
    pathExt: process.env.PATHEXT,
    platform: process.platform,
    isExecutable: (path) => {
      // biome-ignore lint/plugin: a file that cannot be probed is not an executable
      try {
        accessSync(path, constants.X_OK);
        return true;
      } catch {
        return false;
      }
    },
  };
}
