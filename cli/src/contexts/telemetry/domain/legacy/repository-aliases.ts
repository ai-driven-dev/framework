import { tryParseJson } from "../../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../../kernel/reading/plain-object.js";
import { compareText } from "../text-order.js";

/** Which id an earlier version gave a repository that now has another, and whether every store
 * has been rewritten to it. Both sides are hashes or root commits: no address is kept. */
export interface RepositoryAliases {
  readonly ids: ReadonlyMap<string, string>;
  readonly complete: boolean;
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
  return { ids: new Map(entries as [string, string][]), complete: object.complete };
}

export function renderRepositoryAliases({ ids, complete }: RepositoryAliases): string {
  const aliases = Object.fromEntries([...ids].sort(([a], [b]) => compareText(a, b)));
  return `${JSON.stringify({ version: FORMAT, complete, aliases }, null, 2)}\n`;
}
