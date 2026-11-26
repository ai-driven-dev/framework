/** Writes a clone's consent into the repository's own git config. */
export interface ConsentWriter {
  set(root: string, value: string): Promise<void>;
}
