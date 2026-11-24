/** Rewrites a JSON config over its current text. The domain names the capability; a profile hands
 * it the adapter that keeps a person's comments, so no domain file imports a JSONC library. */
export interface JsonWriter {
  rewrite(current: string, next: Record<string, unknown>): string;
}

/** `next`, a serialized result, written over `existing` through the writer so the comments a person
 * wrote stay; `next` as is when there is no writer or nothing changed. */
export function keepingComments(
  writer: JsonWriter | undefined,
  existing: string | null,
  next: string
): string {
  if (writer === undefined || existing === null || existing === next) return next;
  return writer.rewrite(existing, JSON.parse(next));
}
