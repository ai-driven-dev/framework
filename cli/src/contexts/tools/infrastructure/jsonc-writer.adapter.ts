import { applyEdits, modify, type ParseError, parse } from "jsonc-parser";

type Path = (string | number)[];

const FORMAT = { formattingOptions: { tabSize: 2, insertSpaces: true } };

/** JSONC through jsonc-parser. Satisfies the tools context's `JsonWriter` by shape: it edits only
 * what differs, so the comments and layout a person wrote around it stay. */
export class JsoncWriter {
  rewrite(current: string, next: Record<string, unknown>): string {
    if (current.trim() === "") return JSON.stringify(next, null, 2);
    const errors: ParseError[] = [];
    const before: unknown = parse(current, errors, { allowTrailingComma: true });
    if (errors.length > 0 || !isRecord(before)) return JSON.stringify(next, null, 2);
    let text = current;
    for (const [path, value] of differences(before, next, [])) {
      text = applyEdits(text, modify(text, path, value, FORMAT));
    }
    return text;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Each path whose value differs, `undefined` where `next` dropped it; objects are compared key by
 * key, anything else as a whole. */
function differences(
  before: Record<string, unknown>,
  next: Record<string, unknown>,
  at: Path
): [Path, unknown][] {
  const dropped = Object.keys(before)
    .filter((key) => !(key in next))
    .map((key): [Path, unknown] => [[...at, key], undefined]);
  const changed = Object.entries(next).flatMap(([key, value]): [Path, unknown][] => {
    const old = before[key];
    if (isRecord(old) && isRecord(value)) return differences(old, value, [...at, key]);
    return JSON.stringify(old) === JSON.stringify(value) ? [] : [[[...at, key], value]];
  });
  return [...dropped, ...changed];
}
