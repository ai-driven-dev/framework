/** A marketplace the project registers that a tool's own settings file no longer declares. */
export interface UndeclaredMarketplace {
  readonly tool: string;
  readonly name: string;
  /** The tool's machine-local settings file, relative to the project root. */
  readonly file: string;
}

export interface InspectDeclaredMarketplacesResult {
  readonly findings: readonly UndeclaredMarketplace[];
  /** Declared from this project's built cache although the project no longer registers it. */
  readonly stale: readonly UndeclaredMarketplace[];
}
