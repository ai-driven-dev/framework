/** Replaces the installed CLI with the latest release, through the package manager that put it
 * there. */
export interface CliInstaller {
  /** Resolves to the path of the binary that was replaced. */
  install(): string;
}
