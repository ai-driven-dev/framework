/** What a value read back from a stored file or a transcript must be, the same in every format. */

/** A whole number of zero or more. Text that spells one is not. */
export function isCount(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

export function isFilledText(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

export function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function isInstant(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function isListed<T>(list: readonly T[], value: unknown): value is T {
  return list.some((member) => member === value);
}

/** No field but `fields`. A field the caller needs is checked by the caller, which refuses it
 * absent. */
export function hasOnly(object: Record<string, unknown>, fields: readonly string[]): boolean {
  return Object.keys(object).every((key) => fields.includes(key));
}

/** The lines of a stored text that hold something; none when there is no text. */
export function linesIn(text: string | null): string[] {
  return text?.split("\n").filter((line) => line !== "") ?? [];
}

export function counter(value: unknown): number | null {
  return isCount(value) ? value : null;
}

export function text(value: unknown): string | null {
  return isFilledText(value) ? value : null;
}
