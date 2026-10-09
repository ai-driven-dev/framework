/** The previous version's run journal, git-ignored under this entry. */
export const RUNS_ENTRY = "aidd_docs/runs/";
export const RUNS_DIR = "aidd_docs/runs";

export type IgnoreRewrite =
  | { readonly kind: "untouched" }
  | { readonly kind: "emptied" }
  | { readonly kind: "rewritten"; readonly text: string };

/** `.gitignore` without the journal's entry, every other byte kept. */
export function withoutRunsEntry(text: string): IgnoreRewrite {
  const lines = text.split("\n");
  const kept = lines.filter((line) => line.trim() !== RUNS_ENTRY);
  if (kept.length === lines.length) return { kind: "untouched" };
  return kept.every((line) => line.trim() === "")
    ? { kind: "emptied" }
    : { kind: "rewritten", text: kept.join("\n") };
}
