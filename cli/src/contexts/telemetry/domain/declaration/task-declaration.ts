import { plainObjectIn } from "../../../../shared/domain/reading/plain-object.js";
import { hasOnly, isFilledText, isInstant, isListed, isNullableText } from "../read-back.js";

/** The declarers a stored line may name. `hook-intercept` is read from old data: no hook writes
 * it anymore. */
const DECLARED_BY = ["command", "hook-intercept"] as const;
type DeclaredBy = (typeof DECLARED_BY)[number];

export type DeclarationRequest =
  | { readonly kind: "task"; readonly task: string; readonly ticket: string | null }
  | { readonly kind: "none" };

/** Text as a person typed it, trimmed; `null` when nothing is left. A report filter is trimmed
 * the same way, so it compares with what was stored. */
export function textOrNull(value: string | null | undefined): string | null {
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

export function declarationOf(request: DeclarationRequest, now: Date): TaskDeclaration {
  const by = "command" as const;
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

/** A `sessions.jsonl` line read back, or `null` when it is not exactly one. */
export function parseSessionDeclaration(line: string): SessionDeclaration | null {
  const object = plainObjectIn(line);
  if (object === null || !hasOnly(object, SESSION_DECLARATION_FIELDS)) return null;
  const { session_id, task, ticket, none, declared_at, by } = object;
  if (
    !isFilledText(session_id) ||
    !isNullableText(task) ||
    !isNullableText(ticket) ||
    typeof none !== "boolean" ||
    !isInstant(declared_at) ||
    !isListed(DECLARED_BY, by)
  ) {
    return null;
  }
  return { session_id, task, ticket, none, declared_at, by };
}

/** A `carries.jsonl` line read back, or `null` when it is not exactly one. */
export function parseSessionCarry(line: string): SessionCarry | null {
  const object = plainObjectIn(line);
  if (object === null || !hasOnly(object, SESSION_CARRY_FIELDS)) return null;
  const { session_id, from, at } = object;
  if (!isFilledText(session_id) || !isFilledText(from) || !isInstant(at)) return null;
  return { session_id, from, at };
}
