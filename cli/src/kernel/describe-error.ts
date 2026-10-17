/** A filesystem failure's `code` says what happened where `.message` only restates the path
 * around it; a parse failure carries no `code`, and its message is the useful half. Lives in
 * the domain because a use case describes an error too and may not import infrastructure. */
export function describeError(error: unknown): string {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return error instanceof Error ? error.message : String(error);
}
