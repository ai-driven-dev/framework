/** The settings files that say how long a tool keeps its transcripts, read and never written. */
export interface RetentionSettingsSource {
  /** The text of the project's local file, the project's shared file, then the user's, the way
   * Claude Code ranks them; `null` for one that is not there. */
  texts(root: string): Promise<readonly (string | null)[]>;
}
