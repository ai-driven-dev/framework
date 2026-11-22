import { tryParseJson } from "../../../../shared/domain/reading/json-file.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";

const FORMAT = 1;

/** The id an earlier version gave a repository that now has another, as that version wrote it.
 * Both sides are hashes or root commits: no address is kept. `null` for a file missing, of
 * another format, or damaged: no id is then renamed. */
export function parseRepositoryAliases(text: string | null): ReadonlyMap<string, string> | null {
  const parsed = tryParseJson(text ?? "");
  const object = parsed.ok ? asPlainObject(parsed.value) : null;
  const aliases = asPlainObject(object?.aliases);
  if (object?.version !== FORMAT || aliases === null) return null;
  const renamed = new Map<string, string>();
  for (const [from, to] of Object.entries(aliases)) {
    if (typeof to !== "string" || to === "") return null;
    renamed.set(from, to);
  }
  return renamed;
}
