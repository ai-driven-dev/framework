/** A project's own word on whether it is measured. */
export interface ConsentSource {
  /** The text of the project's `.aidd/config.json`, or `null` when it has none. */
  read(root: string): Promise<string | null>;
}
