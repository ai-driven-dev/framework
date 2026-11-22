import { tryParseJson } from "../../../../shared/domain/reading/json-file.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import type { BranchSnapshot } from "../branch-binding.js";

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
