import { cwdKey, type RepositoryResolution } from "../repository-resolution.js";

/** The remembered directories of a repository, with its consent granted: those of the roots
 * `on` ran in, and every one that was resolved to the same repository, because a linked
 * worktree deleted before `on` is neither of those roots and is still the project's. A
 * directory that is gone is judged by what was remembered of it, so a refusal remembered before
 * the project opted in would keep its transcripts out for good. Entries are kept, never
 * dropped: a dropped one is a directory never seen alive, which is no better. */
export function withConsentGranted(
  resolutions: ReadonlyMap<string, RepositoryResolution>,
  roots: readonly string[],
  repositoryId: string | null,
  caseInsensitive: boolean
): { readonly resolutions: Map<string, RepositoryResolution>; readonly changed: boolean } {
  const wanted = new Set(roots.map((root) => cwdKey(root, caseInsensitive)));
  const next = new Map(resolutions);
  let changed = false;
  for (const [key, resolution] of resolutions) {
    if (resolution.consented) continue;
    const ofRepository = repositoryId !== null && resolution.repository_id === repositoryId;
    if (!ofRepository && !wanted.has(cwdKey(resolution.root, caseInsensitive))) continue;
    next.set(key, { ...resolution, consented: true });
    changed = true;
  }
  return { resolutions: next, changed };
}
