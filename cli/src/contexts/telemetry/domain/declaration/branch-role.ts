export type BranchRole = "working" | "default" | "detached";

const HEADS = "refs/heads/";
const REMOTE_HEAD_TARGET = "refs/remotes/origin/";
/** What a repository with no remote head is taken to start from. */
const CONVENTIONAL_DEFAULTS: readonly string[] = ["main", "master"];

function after(prefix: string, ref: string | null): string | null {
  const name = ref?.trim() ?? "";
  return name.startsWith(prefix) && name.length > prefix.length ? name.slice(prefix.length) : null;
}

/** The branch `HEAD` is on, from `git symbolic-ref HEAD`, or `null` when it is detached. */
export function currentBranchOf(headRef: string | null): string | null {
  return after(HEADS, headRef);
}

/** What a branch is in its repository. Only a working branch is ever bound to a task: the
 * default branch is where every task ends up, and a detached head names no branch at all.
 * The default is where the remote's own head points; a repository with none falls back to
 * the conventional names. */
export function branchRoleOf(headRef: string | null, originHeadRef: string | null): BranchRole {
  const branch = currentBranchOf(headRef);
  if (branch === null) return "detached";
  const remoteDefault = after(REMOTE_HEAD_TARGET, originHeadRef);
  const isDefault =
    remoteDefault === null ? CONVENTIONAL_DEFAULTS.includes(branch) : branch === remoteDefault;
  return isDefault ? "default" : "working";
}
