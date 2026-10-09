/** What the previous measurement put in a repository's commit hooks, by the names it used. */
export const TRAILER_DELEGATE_FILE = "aidd-session-trailer.sh";
const HOOK_HEADER = "#!/bin/sh";
const DELEGATE_MARKER = "# Installed by `aidd telemetry on`";

const CALL = /^sh\s+"[^"]*aidd-session-trailer\.sh"\s+"\$@"$/;

/** The one line that called the delegate. Its path was baked in when it was written, so the
 * shape is matched and no path is recomputed. */
export function isTrailerCall(line: string): boolean {
  return CALL.test(line.trim());
}

export type HookRewrite =
  | { readonly kind: "untouched" }
  /** Only the hook's header and blank lines were left: the previous version made the file. */
  | { readonly kind: "emptied" }
  | { readonly kind: "rewritten"; readonly text: string };

/** The hook without the lines that called the delegate. Every other byte stays, line endings
 * and a missing final newline included. */
export function withoutTrailerCall(text: string): HookRewrite {
  const lines = text.split("\n");
  const kept = lines.filter((line) => !isTrailerCall(line));
  if (kept.length === lines.length) return { kind: "untouched" };
  const ownsNothing = kept.every((line) => line.trim() === "" || line.trim() === HOOK_HEADER);
  return ownsNothing ? { kind: "emptied" } : { kind: "rewritten", text: kept.join("\n") };
}

/** Any mention of the delegate, a comment included: a line that names it may run it. */
export function mentionsDelegate(text: string): boolean {
  return text.includes(TRAILER_DELEGATE_FILE);
}

/** Only a script the previous version wrote is ever removed. */
export function isInstalledDelegate(text: string): boolean {
  return text
    .split("\n")
    .slice(0, 3)
    .some((line) => line.trim().startsWith(DELEGATE_MARKER));
}
