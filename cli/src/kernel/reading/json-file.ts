export type ParsedJson = { readonly ok: true; readonly value: unknown } | { readonly ok: false };

/** `JSON.parse` that says whether it parsed, so a caller holding text it may not trust has no
 * `try` of its own to get wrong. */
export function tryParseJson(text: string): ParsedJson {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

export function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
