import { applyEdits, modify, type ParseError, parse } from "jsonc-parser";
import { stripJsonComments } from "../../../shared/domain/reading/jsonc.js";
import { asPlainObject } from "../../../shared/domain/reading/plain-object.js";
import type {
  MainModelInstall,
  MainModelRecord,
  MainModelRefusal,
  MainSessionSettings,
} from "../ports/main-session-settings.js";

/**
 * Sets the main model in `path`, recording what each key held before, and leaves the rest of the
 * file as it is, comments included. A key the person changed since aidd wrote it is theirs again,
 * so its current value becomes the one to restore. Refuses a key holding no string. `schema`
 * heads a file this creates.
 */
export function planMainModelInstall(request: MainModelInstall): {
  content: string;
  record: MainModelRecord;
} {
  const { path, content, values, record, schema } = request;
  const settings = readSettings(content);
  const previous = previousValues(settings, values, record);
  return {
    content: edit(
      content ?? "{}",
      content === null && schema !== undefined ? { $schema: schema, ...values } : values
    ),
    record: {
      path,
      written: values,
      previous,
      created: content === null || (record?.created ?? false),
    },
  };
}

/** What to restore for a key: the value as it stands now, unless aidd wrote it and the person has
 * not touched it since, then what aidd replaced. */
function valueToRestore(
  key: string,
  current: string | null,
  record: MainModelRecord | undefined
): string | null {
  const ours = record !== undefined && Object.hasOwn(record.written, key);
  return ours && current === record.written[key] ? (record.previous[key] ?? null) : current;
}

/** What each key held before aidd wrote it: the value it replaced, or, for a key the person
 * changed since, that new value. Refuses a key holding no string. */
function previousValues(
  settings: Record<string, unknown>,
  values: Record<string, string>,
  record: MainModelRecord | undefined
): Record<string, string | null> {
  const previous: Record<string, string | null> = {};
  for (const key of Object.keys(values)) {
    const value = settings[key];
    if (value !== undefined && typeof value !== "string") {
      throw new Error(`"${key}" is not a string`);
    }
    previous[key] = valueToRestore(key, value ?? null, record);
  }
  return previous;
}

/** Restores the keys aidd's values still hold; leaves a key the person changed as it is.
 * `null` content means the file is to be deleted. Throws on a file it cannot read, so the
 * record survives for a later run. */
export function planMainModelRemoval(
  content: string | null,
  record: MainModelRecord
): string | null {
  if (content === null) return null;
  const settings = readSettings(content);
  const restored: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(record.written)) {
    if (settings[key] === value) restored[key] = record.previous[key] ?? undefined;
  }
  if (Object.keys(restored).length === 0) return content;
  const next = edit(content, restored);
  return record.created && holdsOnlyWhatAiddCreated(next) ? null : next;
}

/** The main-session settings file, edited through jsonc-parser so comments and trailing commas
 * survive. A file either plan refuses is answered as a refusal naming why. */
export const jsoncMainSessionSettings: MainSessionSettings = {
  planInstall: (request) => refusedUnless(() => planMainModelInstall(request)),
  planRemoval: (content, record) =>
    refusedUnless(() => ({ content: planMainModelRemoval(content, record) })),
};

function refusedUnless<T>(plan: () => T): T | MainModelRefusal {
  try {
    return plan();
  } catch (error) {
    return { refused: error instanceof Error ? error.message : String(error) };
  }
}

/** Nothing the person added: no key but the schema aidd headed the file with, and no comment. */
function holdsOnlyWhatAiddCreated(content: string): boolean {
  const keys = Object.keys(readSettings(content)).filter((key) => key !== "$schema");
  return keys.length === 0 && stripJsonComments(content) === content;
}

function readSettings(content: string | null): Record<string, unknown> {
  if (content === null || content.trim() === "") return {};
  const errors: ParseError[] = [];
  const parsed: unknown = parse(content, errors, { allowTrailingComma: true });
  const settings = errors.length > 0 ? null : asPlainObject(parsed);
  if (settings === null) throw new Error("it holds no JSON object");
  return settings;
}

/** Sets each key, or removes it when `undefined`, touching nothing else in the file. */
function edit(content: string, changes: Record<string, string | undefined>): string {
  let text = content.trim() === "" ? "{}" : content;
  for (const [key, value] of Object.entries(changes)) {
    const edits = modify(text, [key], value, {
      formattingOptions: { tabSize: 2, insertSpaces: true },
    });
    text = applyEdits(text, edits);
  }
  return text.endsWith("\n") ? text : `${text}\n`;
}
