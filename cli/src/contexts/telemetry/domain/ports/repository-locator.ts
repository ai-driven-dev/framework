import type { CloneIdentity } from "../consent/clone-identity.js";

export type LocatedDirectory =
  | { readonly status: "gone" }
  | { readonly status: "outside-repository" }
  | {
      readonly status: "repository";
      /** The working tree the directory is in: a linked worktree is its own root. */
      readonly root: string;
      /** The main working tree, which a linked worktree shares its repository with. */
      readonly mainRoot: string;
      /** The clone: the git common dir every linked worktree shares. `null` when the platform
       * gives that directory no identity, and nothing can be said to belong to the clone. */
      readonly clone: CloneIdentity | null;
      /** `origin`'s url as git prints it; the caller reduces it and never keeps it. */
      readonly remote: string | null;
      /** The lowest root commit sha. */
      readonly rootCommit: string | null;
    };

export interface RepositoryLocator {
  /** What a working directory is, as it stands now. */
  locate(cwd: string): Promise<LocatedDirectory>;
}
