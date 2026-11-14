import { repositoryIdOf } from "../../domain/repository-identity.js";
import {
  cwdKey,
  type RepositoryResolution,
  resolutionKey,
  sameResolution,
} from "../../domain/repository-resolution.js";
import type { ResolutionStore } from "../../ports/resolution-store.js";
import type { UsageLedger } from "../../ports/usage-ledger.js";
import type { ResolutionEnvironment } from "../directory-resolver.js";
import type { Located } from "./clone-consent.js";

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
  const key = resolutionKey(dir, located.clone);
  const earlier = held.get(key);
  const own: RepositoryResolution = {
    dir,
    repository_id: id,
    root: located.root,
    clone: located.clone,
    seen_at: earlier?.seen_at ?? at.toISOString(),
  };
  if (sameResolution(earlier, own)) return;
  held.set(key, own);
  await store.save(held);
}

/** The roots a clone was switched on in, remembered under the ledger's lock, which every
 * writer of `roots.json` holds. */
export class OwnRoots {
  constructor(
    private readonly ledger: UsageLedger,
    private readonly resolutions: ResolutionStore,
    private readonly environment: ResolutionEnvironment
  ) {}

  remember(located: Located): Promise<void> {
    return this.ledger.exclusively(() =>
      rememberOwnRoot(
        this.resolutions,
        located,
        this.environment.caseInsensitiveFileSystem,
        this.environment.now()
      )
    );
  }
}
