/** A marketplace the project registers that a tool's own settings file no longer declares. */
export interface UndeclaredMarketplace {
  readonly tool: string;
  readonly name: string;
  /** The tool's machine-local settings file, relative to the project root. */
  readonly file: string;
}

/** A tool's machine-local settings file that exists but cannot be read as a settings object. */
export interface UnparseableSettings {
  readonly tool: string;
  /** Relative to the project root. */
  readonly file: string;
  readonly reason: string;
}

export interface InspectDeclaredMarketplacesResult {
  readonly findings: readonly UndeclaredMarketplace[];
  /** Declared from this project's built cache although the project no longer registers it. */
  readonly stale: readonly UndeclaredMarketplace[];
  /** Set instead of `findings` and `stale`: a file that cannot be read declares nothing to compare. */
  readonly unparseable: readonly UnparseableSettings[];
}
