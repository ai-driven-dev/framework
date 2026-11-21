/** What a person is told to run next, named so presentation words it: the layers below it name no
 * command. */
export type MessageHint =
  | "full-removal"
  | "purge-user-scope"
  | "update-cli"
  | "sync-after-path"
  | "sync-after-build"
  | "rerun-setup-global";

/** A message whose closing hint presentation words: `text` is what happened. */
export interface HintedMessage {
  readonly text: string;
  readonly hint?: MessageHint;
}

/** A filesystem failure's `code` says what happened where `.message` only restates the path
 * around it; a parse failure carries no `code`, and its message is the useful half. Lives in
 * the domain because a use case describes an error too and may not import infrastructure. */
export function describeError(error: unknown): string {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return errorMessage(error);
}

/** The message of an Error, the string form of anything else thrown. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
