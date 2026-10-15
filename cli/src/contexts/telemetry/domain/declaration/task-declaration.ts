import { tryParseJson } from "../../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../../kernel/reading/plain-object.js";
import type { LockWait } from "../ports/bindings/bindings-lock.js";

export const DECLARED_BY = ["command", "hook-intercept"] as const;
export type DeclaredBy = (typeof DECLARED_BY)[number];

/** How long a declaration made by the hook waits on the bindings lock, each of the two times it
 * takes it. The hook gives `aidd` 20 s to answer; a wait that ends before that lets `aidd` say
 * who holds the lock, where a longer one would be cut off with no reason. */
export const HOOK_LOCK_WAIT_MS = 8_000;

/** The lock wait a declaration can afford: the lock's own for a person at a terminal. */
export function lockWaitFor(by: DeclaredBy): LockWait | undefined {
  return by === "hook-intercept" ? { waitMs: HOOK_LOCK_WAIT_MS } : undefined;
}

/** What a person declared a piece of work to be: a task, a ticket kept as typed, or that it
 * has no task. */
export interface TaskDeclaration {
  readonly task: string | null;
  readonly ticket: string | null;
  readonly none: boolean;
  /** ISO 8601 UTC. */
  readonly declared_at: string;
  readonly by: DeclaredBy;
}

/** A declaration made in one session. */
export interface SessionDeclaration extends TaskDeclaration {
  readonly session_id: string;
}

/** A session that took the binding of the one it replaced, as that stood at `at`. */
export interface SessionCarry {
  readonly session_id: string;
  readonly from: string;
  readonly at: string;
}

export type DeclarationRequest =
  | { readonly kind: "task"; readonly task: string; readonly ticket: string | null }
  | { readonly kind: "none" };

function textOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/** A task name and ticket as a person typed them, trimmed: the ticket is free text, never
 * parsed or checked against a forge. `null` when there is no name to declare. */
export function requestOf(
  name: string | undefined,
  ticket: string | undefined
): DeclarationRequest | null {
  const task = textOrNull(name);
  return task === null ? null : { kind: "task", task, ticket: textOrNull(ticket) };
}

export function declarationOf(
  request: DeclarationRequest,
  now: Date,
  by: DeclaredBy
): TaskDeclaration {
  return request.kind === "none"
    ? { task: null, ticket: null, none: true, declared_at: now.toISOString(), by }
    : {
        task: request.task,
        ticket: request.ticket,
        none: false,
        declared_at: now.toISOString(),
        by,
      };
}

/** One line of `sessions.jsonl`. The field order is the format. */
export function renderSessionDeclaration(sessionId: string, declaration: TaskDeclaration): string {
  const line: SessionDeclaration = {
    session_id: sessionId,
    task: declaration.task,
    ticket: declaration.ticket,
    none: declaration.none,
    declared_at: declaration.declared_at,
    by: declaration.by,
  };
  return JSON.stringify(line);
}

export const SESSION_DECLARATION_FIELDS = [
  "session_id",
  "task",
  "ticket",
  "none",
  "declared_at",
  "by",
] as const;
export const SESSION_CARRY_FIELDS = ["session_id", "from", "at"] as const;

function hasExactly(object: Record<string, unknown>, fields: readonly string[]): boolean {
  const keys = Object.keys(object);
  return keys.length === fields.length && fields.every((field) => keys.includes(field));
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

function isInstant(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isDeclaredBy(value: unknown): value is DeclaredBy {
  return DECLARED_BY.some((by) => by === value);
}

function plainObjectOf(line: string): Record<string, unknown> | null {
  const parsed = tryParseJson(line);
  return parsed.ok ? asPlainObject(parsed.value) : null;
}

/** A `sessions.jsonl` line read back, or `null` when it is not exactly one. */
export function parseSessionDeclaration(line: string): SessionDeclaration | null {
  const object = plainObjectOf(line);
  if (object === null || !hasExactly(object, SESSION_DECLARATION_FIELDS)) return null;
  const { session_id, task, ticket, none, declared_at, by } = object;
  if (
    !isNonEmptyText(session_id) ||
    !isNullableText(task) ||
    !isNullableText(ticket) ||
    typeof none !== "boolean" ||
    !isInstant(declared_at) ||
    !isDeclaredBy(by)
  ) {
    return null;
  }
  return { session_id, task, ticket, none, declared_at, by };
}

/** A `carries.jsonl` line read back, or `null` when it is not exactly one. */
export function parseSessionCarry(line: string): SessionCarry | null {
  const object = plainObjectOf(line);
  if (object === null || !hasExactly(object, SESSION_CARRY_FIELDS)) return null;
  const { session_id, from, at } = object;
  if (!isNonEmptyText(session_id) || !isNonEmptyText(from) || !isInstant(at)) return null;
  return { session_id, from, at };
}
