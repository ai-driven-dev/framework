export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export const CLI_PACKAGE = "@ai-driven-dev/cli";

export const INSTALL_COMMANDS: Readonly<Record<PackageManager, string>> = {
  npm: `npm install -g ${CLI_PACKAGE}@latest`,
  pnpm: `pnpm add -g ${CLI_PACKAGE}@latest`,
  yarn: `yarn global add ${CLI_PACKAGE}@latest`,
  bun: `bun add -g ${CLI_PACKAGE}@latest`,
};

/** The first match a `which` or a `where` printed: `where` lists one per line, CRLF on Windows. */
export function firstBinaryPath(output: string): string {
  return (output.trim().split(/\r?\n/)[0] as string).trim();
}

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

/** Whether what a failed install wrote to stderr says the process had no right to write where
 * it installs. */
export function isPermissionFailure(stderr: string): boolean {
  return /\bEPERM\b|\bEACCES\b/.test(stderr);
}
