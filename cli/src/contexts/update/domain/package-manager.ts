export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export const CLI_PACKAGE = "@ai-driven-dev/cli";

export const INSTALL_COMMANDS: Readonly<Record<PackageManager, string>> = {
  npm: `npm install -g ${CLI_PACKAGE}@latest`,
  pnpm: `pnpm add -g ${CLI_PACKAGE}@latest`,
  yarn: `yarn global add ${CLI_PACKAGE}@latest`,
  bun: `bun add -g ${CLI_PACKAGE}@latest`,
};

/** The manager that installed the binary at `binaryPath`, read from where it sits. A path with
 * no manager's marker is npm's: it installs to system paths such as `/usr/local/bin`. */
export function packageManagerOf(binaryPath: string): PackageManager {
  const path = binaryPath.replace(/\\/g, "/");
  if (path.includes("/pnpm/")) return "pnpm";
  // yarn: ~/.yarn/bin (Unix) or AppData/Local/Yarn/bin (Windows)
  if (path.includes("/.yarn/") || path.toLowerCase().includes("/yarn/bin/")) return "yarn";
  // bun: ~/.bun/bin (Unix) or AppData/Local/bun (Windows)
  if (path.includes("/.bun/") || path.toLowerCase().includes("/bun/bin/")) return "bun";
  return "npm";
}
