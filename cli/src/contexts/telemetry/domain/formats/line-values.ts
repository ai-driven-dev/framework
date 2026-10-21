/** Reading a transcript line's values the same way in every tool's format. */
export type Json = Record<string, unknown>;

export function counter(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** A counter that must be there: absent or malformed is unknown, and said so. */
export function expected(
  source: Json,
  field: string,
  where: string,
  notes: string[]
): number | null {
  const value = counter(source[field]);
  if (value === null) notes.push(`${where}.${field} is missing or not a count`);
  return value;
}
