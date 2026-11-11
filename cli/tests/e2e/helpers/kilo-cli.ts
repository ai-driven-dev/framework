import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, posix, win32 } from "node:path";

const WINDOWS_KILO_PACKAGES = [
  "cli-windows-x64-baseline",
  "cli-windows-x64",
  "cli-windows-arm64",
] as const;

export function resolveKiloBin(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  pathExists: (path: string) => boolean = existsSync
): string {
  if (platform === "win32") {
    const path = win32;
    const appData = env.APPDATA ?? path.join(env.USERPROFILE ?? homedir(), "AppData", "Roaming");
    const prefixes = [
      ...new Set(
        [env.NPM_CONFIG_PREFIX, path.join(appData, "npm")].filter((prefix): prefix is string =>
          Boolean(prefix)
        )
      ),
    ];
    const candidates = prefixes.flatMap((prefix) => {
      const globalModules = path.join(prefix, "node_modules");
      const cliModules = path.join(globalModules, "@kilocode", "cli", "node_modules");
      return WINDOWS_KILO_PACKAGES.flatMap((name) => [
        path.join(globalModules, "@kilocode", name, "bin", "kilo.exe"),
        path.join(cliModules, "@kilocode", name, "bin", "kilo.exe"),
      ]);
    });
    return (
      candidates.find(pathExists) ??
      prefixes.map((prefix) => path.join(prefix, "kilo.cmd")).find(pathExists) ??
      path.join(prefixes[0], "kilo.cmd")
    );
  }

  const pathDelimiter = platform === process.platform ? delimiter : ":";
  for (const directory of (env.PATH ?? "").split(pathDelimiter)) {
    if (directory === "") continue;
    const candidate = posix.join(directory, "kilo");
    if (pathExists(candidate)) return candidate;
  }
  return "kilo";
}

export const KILO_BIN = resolveKiloBin();
export const KILO_SHELL = KILO_BIN.endsWith(".cmd");
const kiloTreeSitterDir = KILO_BIN.endsWith(".exe")
  ? win32.join(win32.dirname(KILO_BIN), "tree-sitter")
  : "";
export const KILO_ENV: Record<string, string> =
  kiloTreeSitterDir !== "" && existsSync(win32.join(kiloTreeSitterDir, "tree-sitter.wasm"))
    ? { KILO_TREE_SITTER_WASM_DIR: kiloTreeSitterDir }
    : {};
