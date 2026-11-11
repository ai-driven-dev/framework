import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

const KILO_PREFIX = join(
  process.env.APPDATA ?? join(process.env.USERPROFILE ?? "", "AppData", "Roaming"),
  "npm",
  "node_modules",
  "@kilocode",
  "cli"
);

function resolveKiloBin(): string {
  if (process.platform === "win32") {
    return (
      [
        join(KILO_PREFIX, "node_modules", "@kilocode", "cli-windows-x64", "bin", "kilo.exe"),
        join(
          KILO_PREFIX,
          "node_modules",
          "@kilocode",
          "cli-windows-x64-baseline",
          "bin",
          "kilo.exe"
        ),
        join(KILO_PREFIX, "node_modules", "@kilocode", "cli-windows-arm64", "bin", "kilo.exe"),
      ].find((path) => existsSync(path)) ?? join(process.env.APPDATA ?? "", "npm", "kilo.cmd")
    );
  }

  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (directory === "") continue;
    const candidate = join(directory, "kilo");
    if (existsSync(candidate)) return candidate;
  }
  return "kilo";
}

export const KILO_BIN = resolveKiloBin();
export const KILO_SHELL = KILO_BIN.endsWith(".cmd");
