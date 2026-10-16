import { tryParseJson } from "../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../kernel/reading/plain-object.js";
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
  /** The oldest reflog entry when first read: the work before it was not on this branch. */
  readonly branch_created_at: string | null;
  readonly snapshot_at: string;
}

export function snapshotKey(repositoryId: string, branch: string): string {
  return `${repositoryId}\u0000${branch}`;
}

const PREFIX = "branch.";
/** git lists the variable part of a key in lower case; the branch name keeps its case. */
const FIELDS = {
  task: ".aiddtask",
  ticket: ".aiddticket",
  declared_at: ".aidddeclaredat",
} as const;

interface DeclaredFields {
  task: string | null;
  ticket: string | null;
  declared_at: string | null;
}

function textOrNull(value: string): string | null {
  return value === "" ? null : value;
}

/** Reads `git config --local -z --get-regexp` output: entries end in NUL, a key and its value
 * are split by a newline, and a key given with no value has no newline at all. A branch name
 * can hold dots, so the known suffix is cut off the end, never split on. */
export function parseBranchConfig(output: string): BranchConfigBinding[] {
  const branches = new Map<string, DeclaredFields>();
  for (const entry of output.split("\0")) {
    if (!entry.startsWith(PREFIX)) continue;
    const newline = entry.indexOf("\n");
    const key = newline === -1 ? entry : entry.slice(0, newline);
    const value = newline === -1 ? "" : entry.slice(newline + 1);
    const lower = key.toLowerCase();
    for (const [field, suffix] of Object.entries(FIELDS) as [keyof DeclaredFields, string][]) {
      if (!lower.endsWith(suffix)) continue;
      const branch = key.slice(PREFIX.length, key.length - suffix.length);
      const held = branches.get(branch) ?? { task: null, ticket: null, declared_at: null };
      held[field] = textOrNull(value);
      branches.set(branch, held);
    }
  }
  return [...branches.entries()]
    .sort(([a], [b]) => compareText(a, b))
    .map(([branch, fields]) => ({
      branch,
      ...fields,
      none: fields.declared_at !== null && fields.task === null,
    }));
}

/** `git reflog show --date=iso-strict --format=%gd` lists newest first, each as
 * `refs/heads/<name>@{<time>}`; the last line is the branch's creation. */
export function oldestReflogTime(output: string): string | null {
  const lines = output.split("\n").filter((line) => line !== "");
  const last = lines.at(-1);
  if (last === undefined) return null;
  const open = last.lastIndexOf("@{");
  if (open === -1 || !last.endsWith("}")) return null;
  const instant = Date.parse(last.slice(open + 2, -1));
  return Number.isNaN(instant) ? null : new Date(instant).toISOString();
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
export function nextSnapshot(
  repositoryId: string,
  latest: BranchSnapshot | undefined,
  observed: BranchConfigBinding,
  reflogCreatedAt: string | null,
  now: string
): BranchSnapshot | null {
  const next: BranchSnapshot = {
    repository_id: repositoryId,
    ...observed,
    branch_created_at: carriedCreation(latest, observed) ?? reflogCreatedAt,
    snapshot_at: now,
  };
  return latest !== undefined && same(latest, next) ? null : next;
}

function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isBranchSnapshot(
  object: Record<string, unknown>
): object is Record<string, unknown> & BranchSnapshot {
  return (
    typeof object.repository_id === "string" &&
    object.repository_id !== "" &&
    typeof object.branch === "string" &&
    object.branch !== "" &&
    typeof object.snapshot_at === "string" &&
    typeof object.none === "boolean" &&
    isNullableText(object.task) &&
    isNullableText(object.ticket) &&
    isNullableText(object.declared_at) &&
    isNullableText(object.branch_created_at)
  );
}

/** A snapshot line read back, or `null` when it is not one. */
export function parseBranchSnapshot(line: string): BranchSnapshot | null {
  const parsed = tryParseJson(line);
  const object = parsed.ok ? asPlainObject(parsed.value) : null;
  return object !== null && isBranchSnapshot(object) ? object : null;
}
