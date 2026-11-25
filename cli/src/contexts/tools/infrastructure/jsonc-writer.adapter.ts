import { applyEdits, modify, parse } from "jsonc-parser";
import { asPlainObject } from "../../../shared/domain/reading/plain-object.js";
import type { JsonWriter } from "../domain/formats/json-writer.js";

type Path = (string | number)[];

const FORMAT = { formattingOptions: { tabSize: 2, insertSpaces: true } };

// Twin of the installation context's settings editor, kept apart: sharing it would force a port into `shared` that neither context needs.
/** JSONC through jsonc-parser, the tools context's `JsonWriter`: it edits only
 * what differs, so the comments and layout a person wrote around it stay. */
export class JsoncWriter implements JsonWriter {
  // Limit: `current` is text the caller already parsed as a JSON object; blank or malformed text never arrives.
  rewrite(current: string, next: Record<string, unknown>): string {
    const before = asPlainObject(parse(current, [], { allowTrailingComma: true })) ?? {};
    let text = current;
    for (const [path, value] of differences(before, next, [])) {
      text = applyEdits(text, modify(text, path, value, FORMAT));
    }
    return text;
  }
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
    const [oldObject, newObject] = [asPlainObject(old), asPlainObject(value)];
    if (oldObject && newObject) return differences(oldObject, newObject, [...at, key]);
    return JSON.stringify(old) === JSON.stringify(value) ? [] : [[[...at, key], value]];
  });
  return [...dropped, ...changed];
}
