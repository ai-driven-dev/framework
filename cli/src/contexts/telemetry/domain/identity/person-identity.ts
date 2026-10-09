import { tryParseJson } from "../../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../../kernel/reading/plain-object.js";

const MAX_LENGTH = 128;
// biome-ignore lint/suspicious/noControlCharactersInRegex: a control character is what is refused
const CONTROL = /[\u0000-\u001f\u007f]/;

/** The identifier a person chose to be named by: one trimmed line, or `null`. */
export function personIdOf(typed: string): string | null {
  const id = typed.trim();
  return id === "" || id.length > MAX_LENGTH || CONTROL.test(id) ? null : id;
}

/** `identity.json`: exactly one field. */
export function renderPersonIdentity(personId: string): string {
  return `${JSON.stringify({ person_id: personId })}\n`;
}

/** The identifier an `identity.json` holds, or `null` when it is not exactly the file this
 * version writes. A file of another shape is never carried over. */
export function parsePersonIdentity(text: string | null): string | null {
  const parsed = tryParseJson(text ?? "");
  const object = parsed.ok ? asPlainObject(parsed.value) : null;
  if (object === null || Object.keys(object).length !== 1) return null;
  return typeof object.person_id === "string" ? personIdOf(object.person_id) : null;
}
