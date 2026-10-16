/** Who git says the person is: only ever offered to them, never stored by itself. */
export interface GitUserSource {
  /** `user.name` as git resolves it in `cwd`, else `user.email`, or `null` when neither is set. */
  userIn(cwd: string): Promise<string | null>;
}
