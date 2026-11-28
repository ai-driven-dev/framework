const HEADS = "refs/heads/";
const REMOTE_HEAD_TARGET = "refs/remotes/origin/";
/** What a repository with no remote head is taken to start from. */
const CONVENTIONAL_DEFAULTS: readonly string[] = ["main", "master"];

/** Only a working branch is bound to a task; the default is origin's head, else main/master. */
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
