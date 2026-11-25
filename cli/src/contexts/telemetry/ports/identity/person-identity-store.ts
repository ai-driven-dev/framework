/** The identifier a person chose to be named by, kept apart from every other file of the
 * measurement. */
export interface PersonIdentityStore {
  /** The identifier, or `null` when none was chosen or the file is not one this version wrote. */
  read(): Promise<string | null>;
  /** Replaces whatever was chosen before. */
  write(personId: string): Promise<void>;
  /** Whether there was a file to remove. */
  remove(): Promise<boolean>;
}
