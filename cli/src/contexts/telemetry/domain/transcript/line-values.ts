import { counter } from "../read-back.js";

/** Reading a transcript line's values the same way in every tool's format. */
export type Json = Record<string, unknown>;

/** A counter that must be there: absent or malformed is unknown, and said so under `where`. */
export function expected(where: string, notes: string[]) {
  return (source: Json, field: string): number | null => {
    const value = counter(source[field]);
    if (value === null) notes.push(`${where}.${field} is missing or not a count`);
    return value;
  };
}
