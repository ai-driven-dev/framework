/** What measurement keeps in a repository's own git config. */
export interface RepositoryKeys {
  /** The branch task keys: a branch's declared task, ticket and the time it was declared. */
  readonly taskKeys: number;
  /** Whether the clone's consent (`aidd.telemetry`) is set. */
  readonly consent: boolean;
}

export interface RepositoryDeclarations {
  /** The keys it holds. */
  count(root: string): Promise<RepositoryKeys>;
  /** Removes them, and answers what there was. */
  clear(root: string): Promise<RepositoryKeys>;
}
