const HEADS = "refs/heads/";
const REMOTE_HEAD_TARGET = "refs/remotes/origin/";
/** What a repository with no remote head is taken to start from. */
const CONVENTIONAL_DEFAULTS: readonly string[] = ["main", "master"];

/** The branch `HEAD` is on, read from `git symbolic-ref HEAD`, and what it is in its
 * repository. Only a working branch is ever bound to a task: the default branch is where every
 * task ends up, and a detached head names no branch at all. The default is where the remote's
 * own head points; a repository with none falls back to the conventional names. */
export type BranchHead =
  | { readonly role: "working" | "default"; readonly branch: string }
  | { readonly role: "detached"; readonly branch: null };

export type BranchRole = BranchHead["role"];

function after(prefix: string, ref: string | null): string | null {
  const name = ref?.trim();
  return name?.startsWith(prefix) && name.length > prefix.length ? name.slice(prefix.length) : null;
}

export function branchHeadOf(headRef: string | null, originHeadRef: string | null): BranchHead {
  const branch = after(HEADS, headRef);
  if (branch === null) return { role: "detached", branch };
  const remoteDefault = after(REMOTE_HEAD_TARGET, originHeadRef);
  const isDefault =
    remoteDefault === null ? CONVENTIONAL_DEFAULTS.includes(branch) : branch === remoteDefault;
  return { role: isDefault ? "default" : "working", branch };
}
