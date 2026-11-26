/** A file the translation produces: where it lands and what it holds. Hashing is the caller's. */
export interface OutputFile {
  readonly relativePath: string;
  readonly content: string;
}
