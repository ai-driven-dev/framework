import { tryParseJson } from "../../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../../kernel/reading/plain-object.js";

export type LegacyConfigCleaning =
  /** No file, or one with no `telemetry` key. */
  | { readonly status: "none" }
  /** A file that does not parse is never rewritten: what it holds cannot be kept. */
  | { readonly status: "unparseable" }
  | { readonly status: "block-removed"; readonly text: string }
  /** The block was all the file held. */
  | { readonly status: "file-emptied" };

const KEY = "telemetry";
const WHITESPACE = /\s/u;

/** Where the value of a string token ends, for a token opening at `start`. */
function endOfString(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i += 1) {
    if (text[i] === "\\") i += 1;
    else if (text[i] === '"') return i + 1;
  }
  return text.length;
}

/** Where the value starting at `start` ends: a string, or a balanced object or array, or a
 * bare word up to the next separator. */
function endOfValue(text: string, start: number): number {
  const first = text[start];
  if (first === '"') return endOfString(text, start);
  if (first !== "{" && first !== "[") {
    let i = start;
    while (i < text.length && !",}] \t\r\n".includes(text[i] as string)) i += 1;
    return i;
  }
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') i = endOfString(text, i) - 1;
    else if (c === "{" || c === "[") depth += 1;
    else if ((c === "}" || c === "]") && --depth === 0) return i + 1;
  }
  return text.length;
}

function skipSpace(text: string, from: number): number {
  let i = from;
  while (i < text.length && WHITESPACE.test(text[i] as string)) i += 1;
  return i;
}

/** The text without its top-level `telemetry` property, every other byte as it was, or `null`
 * when the property cannot be found by this scan (the caller then re-renders). */
function withoutKeyText(text: string): string | null {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') {
      const end = endOfString(text, i);
      const colon = skipSpace(text, end);
      if (depth === 1 && text[colon] === ":" && text.slice(i + 1, end - 1) === KEY) {
        return cut(text, i, endOfValue(text, skipSpace(text, colon + 1)));
      }
      i = end - 1;
    } else if (c === "{" || c === "[") depth += 1;
    else if (c === "}" || c === "]") depth -= 1;
  }
  return null;
}

/** Removes `[start, end)` and one adjoining comma, and the whole line when the property had
 * it to itself. */
function cut(text: string, start: number, end: number): string {
  let from = start;
  let to = end;
  const next = skipSpace(text, to);
  if (text[next] === ",") {
    to = next + 1;
  } else {
    // The last property: the comma before it goes instead.
    let before = from;
    while (before > 0 && WHITESPACE.test(text[before - 1] as string)) before -= 1;
    if (text[before - 1] === ",") from = before - 1;
  }
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const restOfLine = /^[ \t]*\r?\n/u.exec(text.slice(to));
  if (text.slice(lineStart, start).trim() === "" && restOfLine !== null && from === start) {
    from = lineStart;
    to += restOfLine[0].length;
  } else {
    // Sharing its line: the spaces that followed the comma went with it.
    to += (/^[ \t]*/u.exec(text.slice(to)) as RegExpExecArray)[0].length;
  }
  return text.slice(0, from) + text.slice(to);
}

/** `.aidd/config.json` without the `telemetry` block the previous version wrote there, and
 * every other byte as it was. The block held that version's own switch (`enabled`, an
 * `endpoint`, ...); nothing of it means anything to this one. */
export function withoutPreviousTelemetry(text: string | null): LegacyConfigCleaning {
  if (text === null) return { status: "none" };
  const parsed = tryParseJson(text);
  const config = parsed.ok ? asPlainObject(parsed.value) : null;
  if (config === null) return { status: "unparseable" };
  if (!(KEY in config)) return { status: "none" };
  const rest = Object.fromEntries(Object.entries(config).filter(([name]) => name !== KEY));
  if (Object.keys(rest).length === 0) return { status: "file-emptied" };
  const cut = withoutKeyText(text);
  const reparsed = cut === null ? null : tryParseJson(cut);
  const surgical =
    reparsed?.ok === true && JSON.stringify(reparsed.value) === JSON.stringify(rest) ? cut : null;
  return {
    status: "block-removed",
    text: surgical ?? `${JSON.stringify(rest, null, 2)}\n`,
  };
}
