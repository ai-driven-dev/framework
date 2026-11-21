/** What a machine-scope purge reads and removes on the machine itself. */
export interface MachineStatePurge {
  /** Every version directory found under the user config directory's built cache, read
   * structurally and never trusted from any one tool's own manifest entry. */
  builtVersions(): Promise<readonly string[]>;
  /** Removes the whitelisted machine state, then the framework marketplace's user registration. */
  purge(projectRoot: string): Promise<void>;
}
