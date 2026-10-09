/** The task declarations a repository's own git config holds. */
export interface RepositoryDeclarations {
  /** The declaration keys it holds. */
  count(root: string): Promise<number>;
  /** Removes them, and answers how many there were. */
  clear(root: string): Promise<number>;
}
