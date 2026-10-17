import { tryParseJson } from "../../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../../kernel/reading/plain-object.js";
import { compareText } from "../text-order.js";

/** Which id an earlier version gave a repository that now has another, and whether every store
 * has been rewritten to it. Both sides are hashes or root commits: no address is kept. */
export interface RepositoryAliases {
  readonly ids: ReadonlyMap<string, string>;
  /** Every store has been rewritten under `ids`. */
  readonly complete: boolean;
  /** Roots that could not be read, or were not there, when last looked at: looked at again by
   * the next run, since an earlier id can only be told from a clone's origin. */
  readonly pending: readonly string[];
}

const FORMAT = 1;

/** `null` for a file missing, of another format, or damaged: the table is then made again. */
export function parseRepositoryAliases(text: string | null): RepositoryAliases | null {
  const parsed = tryParseJson(text ?? "");
  const object = parsed.ok ? asPlainObject(parsed.value) : null;
  const aliases = asPlainObject(object?.aliases);
  if (object?.version !== FORMAT || typeof object.complete !== "boolean" || aliases === null) {
    return null;
  }
  const entries = Object.entries(aliases);
  if (entries.some(([, id]) => typeof id !== "string" || id === "")) return null;
  const { pending } = object;
  if (!Array.isArray(pending) || pending.some((root) => typeof root !== "string")) return null;
  return { ids: new Map(entries as [string, string][]), complete: object.complete, pending };
}

export function renderRepositoryAliases({ ids, complete, pending }: RepositoryAliases): string {
  const aliases = Object.fromEntries([...ids].sort(([a], [b]) => compareText(a, b)));
  const roots = [...pending].sort(compareText);
  return `${JSON.stringify({ version: FORMAT, complete, aliases, pending: roots }, null, 2)}\n`;
}
