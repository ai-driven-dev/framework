import { tryParseJson } from "../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../kernel/reading/plain-object.js";
import { compareText } from "./text-order.js";

/** What a working directory was found to be, the first time it was seen alive. */
export interface RepositoryResolution {
  readonly repository_id: string;
  /** The repository's working-tree root. */
  readonly root: string;
  /** Whether the project had opted in then. */
  readonly consented: boolean;
}

/** The key a directory is remembered under. File systems that ignore case (macOS, Windows)
 * answer the same directory to two spellings, so the key folds them into one. */
export function cwdKey(cwd: string, caseInsensitive: boolean): string {
  return caseInsensitive ? cwd.toLowerCase() : cwd;
}

function isResolution(value: unknown): value is RepositoryResolution {
  const object = asPlainObject(value);
  return (
    object !== null &&
    typeof object.repository_id === "string" &&
    object.repository_id !== "" &&
    typeof object.root === "string" &&
    typeof object.consented === "boolean"
  );
}

/** A file that is missing or unreadable is no resolutions: a directory seen alive is simply
 * resolved again, and one that is gone is counted. */
export function parseResolutions(text: string | null): Map<string, RepositoryResolution> {
  const resolutions = new Map<string, RepositoryResolution>();
  const parsed = tryParseJson(text ?? "");
  for (const [key, value] of Object.entries(parsed.ok ? (asPlainObject(parsed.value) ?? {}) : {})) {
    if (isResolution(value)) resolutions.set(key, value);
  }
  return resolutions;
}

export function renderResolutions(resolutions: ReadonlyMap<string, RepositoryResolution>): string {
  const sorted = [...resolutions.entries()].sort(([a], [b]) => compareText(a, b));
  return `${JSON.stringify(Object.fromEntries(sorted), null, 2)}\n`;
}

/** Why a billed call was read and not stored. */
export type NotStoredReason =
  | "outside-repo"
  | "never-seen-alive"
  | "no-consent"
  | "unreadable-consent"
  | "no-cwd"
  | "undated";
