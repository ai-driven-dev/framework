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

/** The result of `read`, or `fallback` when what it reads is absent (`ENOENT`). Any other failure rethrows. */
export async function whenAbsent<T, F>(read: () => Promise<T>, fallback: F): Promise<T | F> {
  try {
    return await read();
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") return fallback;
    throw error;
  }
}

export function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
