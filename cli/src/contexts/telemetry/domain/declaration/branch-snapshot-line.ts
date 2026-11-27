import { plainObjectIn } from "../../../../shared/domain/reading/plain-object.js";
import type { BranchSnapshot } from "../branch-binding.js";
import { isFilledText, isNullableText } from "../read-back.js";

function isBranchSnapshot(
  object: Record<string, unknown>
): object is Record<string, unknown> & BranchSnapshot {
  return (
    isFilledText(object.repository_id) &&
    isFilledText(object.branch) &&
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
  const object = plainObjectIn(line);
  return object !== null && isBranchSnapshot(object) ? object : null;
}
