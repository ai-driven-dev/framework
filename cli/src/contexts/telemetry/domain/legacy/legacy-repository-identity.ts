import { addressOf, hashOf, ownerAndRepo, type RepositoryFacts } from "../repository-identity.js";

/** The id cli-v5.5.0 stored for a repository: the host case-folded only when scp-like or of a
 * special scheme, the path as written. Kept so the migration can tell which stored id a live
 * clone's origin had (see `StoredUsageMigration`); nothing new is ever named by it. */
export function legacyRepositoryIdOf(facts: RepositoryFacts): string | null {
  const address = facts.remote === null ? null : addressOf(facts.remote);
  const path = address === null ? null : ownerAndRepo(address.path);
  if (address === null || path === null) return facts.rootCommit;
  return hashOf(`${address.scp ? address.host.toLowerCase() : address.host}/${path}`);
}
