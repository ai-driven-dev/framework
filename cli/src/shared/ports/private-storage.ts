/** Where a person's measurement is written: readable by that person alone. */
export interface PrivateStorage {
  /** The directory exists and no one else can enter it. */
  ensureDirectory(path: string): Promise<void>;
  /** The file holds exactly `content`, or still holds what it held: never half of either. */
  replace(path: string, content: string): Promise<void>;
  /** `content` lands on a line of its own, even when a crash left the file without its last
   * newline. */
  append(path: string, content: string): Promise<void>;
}
