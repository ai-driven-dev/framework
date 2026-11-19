import { join } from "node:path";
import {
  judgeConfirmation,
  judgeEmptiness,
  judgeRegistryClearance,
  type PurgeVerdict,
} from "../../domain/policy/cache-purge-policy.js";
import { readRegistrationRecord } from "../../domain/record/registration-record.js";
import type { HostMarketplaceRegistry } from "../../ports/host-marketplace-registry.js";
import { hostNameFor } from "./host-call.js";
import type {
  CacheCandidateResolver,
  RemovedFromHost,
  WithdrawalDeps,
  WithdrawFromHostCommand,
} from "./withdrawal.js";

/** What a purge reads and deletes with. */
export type PurgeDeps = Pick<WithdrawalDeps, "fs" | "logger">;

/** A cache directory a purge is judged for, named in what it logs. */
interface PurgeTarget {
  readonly candidate: string;
  readonly label: string;
}

/** One marketplace's cache and the facts its purge is judged on. */
interface MarketplaceCache {
  readonly cacheRoot: string;
  readonly binary: string;
  readonly hostName: string;
  /** Whether the host's own CLI confirmed this marketplace's removal. */
  readonly removed: boolean;
}

async function deleteWhenJudged(
  deps: PurgeDeps,
  verdict: PurgeVerdict,
  { candidate, label }: PurgeTarget
): Promise<void> {
  if (!verdict.purge) {
    deps.logger.warn(verdict.warning);
    return;
  }
  await deps.fs.deleteDirectory(candidate);
  deps.logger.info(`${label} purged: ${candidate}`);
}

/**
 * `cache/<hostName>/<plugin>/` under the same declared-root-plus-`realpath` containment
 * whitelist `clean`'s own marketplace-level purge shares, but never gated on emptiness the way
 * that one is: this directory holds exactly the content the host is being asked to forget, not a
 * leftover shell another project's install could still hold. `hostName` comes from this tool's
 * own registration record, never the alias, which a host never learns.
 */
export async function purgeCachedPlugin(
  deps: PurgeDeps,
  command: WithdrawFromHostCommand,
  confirmed: boolean
): Promise<void> {
  const { tool, plugin, claims, pluginCacheRoot } = command;
  const registrations = readRegistrationRecord(command.registrations);
  if (pluginCacheRoot === undefined) return;
  const hostName = hostNameFor(registrations, plugin.marketplace);
  if (hostName === undefined) return;
  const label = `${tool.toolId}: cache for '${plugin.name}'`;
  const candidate = await claims.resolveCacheCandidate(
    pluginCacheRoot,
    join(hostName, plugin.name),
    label
  );
  if (candidate === null) return;
  await deleteWhenJudged(deps, judgeConfirmation(label, candidate, confirmed), {
    candidate,
    label,
  });
}

/** Never a tool whose binary was absent: `removed` holds only the tools a pass ran for. A tool
 * whose profile declares no plugin cache is not looked at: no path is invented for a tool that
 * never named one. */
export async function purgeMarketplaceCaches(
  deps: WithdrawalDeps,
  removed: readonly RemovedFromHost[],
  resolveCacheCandidate: CacheCandidateResolver
): Promise<void> {
  for (const { withdrawal, registrations, removedHostNames } of removed) {
    const { tool, cacheRoot } = withdrawal;
    if (cacheRoot === undefined) continue;
    for (const { hostName } of registrations.marketplaces) {
      await purgeMarketplaceCache(
        { ...deps, reader: deps.ports.marketplaceRegistries.get(tool.toolId) },
        {
          cacheRoot,
          binary: registrations.binary,
          hostName,
          removed: removedHostNames.has(hostName),
        },
        resolveCacheCandidate
      );
    }
  }
}

/**
 * A host's cache directory is indexed by a name global to the machine, not to whichever caller
 * is running, so containment alone proves the path cannot escape the declared root, never that
 * the caller still owns what sits inside it. Two proofs, one per declaration:
 *
 * - a tool whose host keeps a marketplace registry (claude) also requires a confirmed host
 *   removal, then rereads the registry: a name gone says nothing there resolves any more;
 * - a tool with a cache directory alone (codex) drives a host that deletes the cached content
 *   itself and leaves only an empty shell, measured. Emptiness proves no data would be lost,
 *   never that this caller emptied it, so the host's own confirmation is required alongside it.
 *
 * A path failing containment, a registry still naming the tenant, or a removal never confirmed
 * is left in place and named.
 */
async function purgeMarketplaceCache(
  deps: PurgeDeps & { readonly reader: HostMarketplaceRegistry | undefined },
  { cacheRoot, binary, hostName, removed }: MarketplaceCache,
  resolveCacheCandidate: CacheCandidateResolver
): Promise<void> {
  const label = `${binary}: cache for '${hostName}'`;
  const candidate = await resolveCacheCandidate(
    cacheRoot,
    hostName,
    `${binary}: cache path for '${hostName}'`
  );
  if (candidate === null) return;
  const target = { candidate, label };
  const confirmation = judgeConfirmation(label, candidate, removed);
  if (!confirmation.purge) {
    await deleteWhenJudged(deps, confirmation, target);
    return;
  }
  if (deps.reader !== undefined) {
    const verdict = judgeRegistryClearance(binary, hostName, candidate, await deps.reader.read());
    await deleteWhenJudged(deps, verdict, target);
    return;
  }
  let entries: string[];
  try {
    entries = await deps.fs.listDirectory(candidate);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  await deleteWhenJudged(deps, judgeEmptiness(label, candidate, entries.length), target);
}
