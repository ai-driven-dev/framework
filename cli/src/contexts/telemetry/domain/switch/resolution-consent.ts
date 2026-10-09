import { cwdKey, type RepositoryResolution } from "../repository-resolution.js";

/** The remembered directories of a repository, with its consent granted. A directory that is
 * gone is judged by what was remembered of it, so a refusal remembered before the project
 * opted in would keep its transcripts out for good. Entries are kept, never dropped: a dropped
 * one is a directory never seen alive, which is no better. */
export function withConsentGranted(
  resolutions: ReadonlyMap<string, RepositoryResolution>,
  roots: readonly string[],
  caseInsensitive: boolean
): { readonly resolutions: Map<string, RepositoryResolution>; readonly changed: boolean } {
  const wanted = new Set(roots.map((root) => cwdKey(root, caseInsensitive)));
  const next = new Map(resolutions);
  let changed = false;
  for (const [key, resolution] of resolutions) {
    if (resolution.consented || !wanted.has(cwdKey(resolution.root, caseInsensitive))) continue;
    next.set(key, { ...resolution, consented: true });
    changed = true;
  }
  return { resolutions: next, changed };
}
