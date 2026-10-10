import type { LocatedDirectory } from "../../domain/ports/repository-locator.js";
import type { ResolutionStore } from "../../domain/ports/resolution-store.js";
import { repositoryIdOf } from "../../domain/repository-identity.js";
import {
  cwdKey,
  type RepositoryResolution,
  sameResolution,
} from "../../domain/repository-resolution.js";

type Located = Extract<LocatedDirectory, { status: "repository" }>;

/** Remembers the root `on` ran in, seen alive and consenting, so `forget` finds its clone even
 * if no session ever ran there. It lifts no refusal: what a clone's deleted directories are
 * judged by is read from the clone, live. A repository with neither a remote nor a commit has
 * nothing to be named by and is not remembered. */
export async function rememberOwnRoot(
  store: ResolutionStore,
  located: Located,
  caseInsensitive: boolean
): Promise<void> {
  const id = repositoryIdOf(located);
  if (id === null) return;
  const held = await store.load();
  const key = cwdKey(located.root, caseInsensitive);
  const own: RepositoryResolution = {
    repository_id: id,
    root: located.root,
    consented: true,
    clone: located.clone,
  };
  if (sameResolution(held.get(key), own)) return;
  held.set(key, own);
  await store.save(held);
}

/** Withdraws, from what was remembered, the consent of every directory of this clone. Once the
 * clone is gone that memory is all there is to judge its deleted directories by, and a stale
 * yes would store what was measured while it was off. It only ever lowers consent, within the
 * one clone that ran `off`. */
export async function forgetConsentOfClone(store: ResolutionStore, clone: string): Promise<void> {
  const held = await store.load();
  let changed = false;
  for (const [key, resolution] of held) {
    if (resolution.clone !== clone || !resolution.consented) continue;
    held.set(key, { ...resolution, consented: false });
    changed = true;
  }
  if (changed) await store.save(held);
}
