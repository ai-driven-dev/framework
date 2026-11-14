/** Claude Code's settings files, read and never written. */
export interface ClaudeSettingsSource {
  /** The text of the project's local file, the project's shared file, then the user's, the way
   * Claude Code ranks them; `null` for one that is not there. */
  texts(root: string): Promise<readonly (string | null)[]>;
}
