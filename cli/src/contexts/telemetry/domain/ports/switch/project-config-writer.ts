/** A project's own `.aidd/config.json`, written. Reading it is `ConsentSource`'s. */
export interface ProjectConfigWriter {
  write(root: string, text: string): Promise<void>;
}
