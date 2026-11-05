import type { LocatedDirectory } from "../../domain/ports/repository-locator.js";
import type { ResolutionStore } from "../../domain/ports/resolution-store.js";
import { repositoryIdOf } from "../../domain/repository-identity.js";
import { cwdKey, rememberResolution } from "../../domain/repository-resolution.js";

type Located = Extract<LocatedDirectory, { status: "repository" }>;

/** Remembers the root `on` ran in, seen alive in its clone, so a declaration made there is
 * known to belong to a repository `forget` can find, though no session ever ran there. A
 * repository with neither a remote nor a commit has nothing to be named by, and a clone the
 * platform cannot identify cannot be remembered: neither is. */
export async function rememberOwnRoot(
  store: ResolutionStore,
  located: Located,
  caseInsensitive: boolean,
  at: Date
): Promise<void> {
  const id = repositoryIdOf(located);
  if (id === null || located.clone === null) return;
  const held = await store.load();
  const dir = cwdKey(located.root, caseInsensitive);
  const result = rememberResolution(
    held,
    { dir, repository_id: id, root: located.root, clone: located.clone },
    at.toISOString()
  );
  if (result.changed) await store.save(held);
}
