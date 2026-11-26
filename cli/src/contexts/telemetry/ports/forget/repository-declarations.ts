/** What measurement keeps in a clone's own git config. */
export interface RepositoryKeys {
  /** The branch task keys: a branch's declared task, ticket and the time it was declared. */
  readonly taskKeys: number;
  /** Whether the clone's consent (`aidd.telemetry`) is set. */
  readonly consent: boolean;
}

/** A clone is named by its common git dir, the one config its linked worktrees share. */
export interface RepositoryDeclarations {
  /** The keys it holds; `null` when the clone no longer exists. */
  count(clone: string): Promise<RepositoryKeys | null>;
  /** Removes them, and answers what there was. */
  clear(clone: string): Promise<RepositoryKeys>;
}
