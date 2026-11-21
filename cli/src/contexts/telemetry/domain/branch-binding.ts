import { compareText } from "./text-order.js";

/** What a branch's git config says about its declaration. */
export interface BranchConfigBinding {
  readonly branch: string;
  readonly task: string | null;
  readonly ticket: string | null;
  /** As the declaration wrote it. */
  readonly declared_at: string | null;
  /** Declared, and declared to have no task. */
  readonly none: boolean;
}

/** A branch's declaration at one moment, kept so a deleted or renamed branch still attributes
 * the work it carried. */
export interface BranchSnapshot extends BranchConfigBinding {
  readonly repository_id: string;
  /** When the branch took its name, from its reflog when first read (see `branchCreatedAt` in `branch-creation.ts`):
   * the work before it was not on this branch. */
  readonly branch_created_at: string | null;
  readonly snapshot_at: string;
}

export function snapshotKey(repositoryId: string, branch: string): string {
  return `${repositoryId}\u0000${branch}`;
}

const PREFIX = "branch.";
/** git lists the variable part of a key in lower case; the branch name keeps its case. */
const FIELDS: readonly (readonly ["task" | "ticket" | "declared_for" | "declared_at", string])[] = [
  ["task", ".aiddtask"],
  ["ticket", ".aiddticket"],
  ["declared_for", ".aidddeclaredfor"],
  ["declared_at", ".aidddeclaredat"],
];

interface DeclaredFields {
  task: string | null;
  ticket: string | null;
  /** The branch the command declared on: a copy or a rename moves the keys, not this name. */
  declared_for: string | null;
  declared_at: string | null;
  /** The keys read so far: one read again was left twice by `git branch -C` or `-M`. */
  seen: Set<string>;
  listedTwice: boolean;
}

/** Only the command declares, and it writes `aiddDeclaredAt` last: a key without it was set by
 * hand or cut short. A stamp naming another branch was carried here by `git branch -c` or
 * `-m`. A key listed twice mixes the declaration copied by `-C` or `-M` with the branch's own:
 * neither is whole. A declaration with no stamp was written before stamping existed and still
 * counts. */
function declaredByTheCommand(branch: string, fields: DeclaredFields): boolean {
  return (
    !fields.listedTwice && fields.declared_at !== null && (fields.declared_for ?? branch) === branch
  );
}

function textOrNull(value: string): string | null {
  return value === "" ? null : value;
}

function emptyFields(): DeclaredFields {
  return {
    task: null,
    ticket: null,
    declared_for: null,
    declared_at: null,
    seen: new Set<string>(),
    listedTwice: false,
  };
}

/** A NUL-terminated entry split into its key and value: a key given with no value has no
 * newline at all. */
function splitEntry(entry: string): { readonly key: string; readonly value: string } {
  const newline = entry.indexOf("\n");
  return newline === -1
    ? { key: entry, value: "" }
    : { key: entry.slice(0, newline), value: entry.slice(newline + 1) };
}

/** The branch and field a key names, the known suffix cut off the end, never split on. */
function fieldOf(key: string) {
  const lower = key.toLowerCase();
  for (const [field, suffix] of FIELDS) {
    if (lower.endsWith(suffix)) return { field, branch: key.slice(PREFIX.length, -suffix.length) };
  }
  return null;
}

function record(branches: Map<string, DeclaredFields>, entry: string): void {
  if (!entry.startsWith(PREFIX)) return;
  const { key, value } = splitEntry(entry);
  const named = fieldOf(key);
  if (named === null) return;
  const held = branches.get(named.branch) ?? emptyFields();
  held.listedTwice ||= held.seen.has(named.field);
  held.seen.add(named.field);
  held[named.field] = textOrNull(value);
  branches.set(named.branch, held);
}

/** Reads `git config --local -z --get-regexp` output into the branches the command declared:
 * entries end in NUL, a key and its value are split by a newline. A branch name can hold dots,
 * so the known suffix is cut off the end, never split on. */
export function parseBranchConfig(output: string): BranchConfigBinding[] {
  const branches = new Map<string, DeclaredFields>();
  for (const entry of output.split("\0")) record(branches, entry);
  return [...branches.entries()]
    .filter(([branch, fields]) => declaredByTheCommand(branch, fields))
    .sort(([a], [b]) => compareText(a, b))
    .map(([branch, { task, ticket, declared_at }]) => ({
      branch,
      task,
      ticket,
      declared_at,
      none: task === null,
    }));
}

/** Whether the reflog has to be read at all: not when this declaration was already snapshotted
 * with a creation time, which the reflog could only report later now that it expires. */
export function needsReflog(
  latest: BranchSnapshot | undefined,
  observed: BranchConfigBinding
): boolean {
  return carriedCreation(latest, observed) === null;
}

function carriedCreation(
  latest: BranchSnapshot | undefined,
  observed: BranchConfigBinding
): string | null {
  return latest !== undefined && latest.declared_at === observed.declared_at
    ? latest.branch_created_at
    : null;
}

function same(a: BranchSnapshot, b: BranchSnapshot): boolean {
  return (
    a.task === b.task &&
    a.ticket === b.ticket &&
    a.none === b.none &&
    a.declared_at === b.declared_at &&
    a.branch_created_at === b.branch_created_at
  );
}

/** The snapshot to append, or `null` when the latest one already says the same. Reflog entries
 * expire, so under one declaration an earlier known creation time is kept over a later reading. */
export function nextSnapshot({
  repositoryId,
  latest,
  observed,
  reflogCreatedAt,
  now,
}: {
  readonly repositoryId: string;
  readonly latest: BranchSnapshot | undefined;
  readonly observed: BranchConfigBinding;
  readonly reflogCreatedAt: string | null;
  readonly now: string;
}): BranchSnapshot | null {
  const next: BranchSnapshot = {
    repository_id: repositoryId,
    ...observed,
    branch_created_at: carriedCreation(latest, observed) ?? reflogCreatedAt,
    snapshot_at: now,
  };
  return latest !== undefined && same(latest, next) ? null : next;
}
