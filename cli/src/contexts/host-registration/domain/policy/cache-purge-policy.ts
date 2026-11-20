import type { HostMarketplaceRegistryReading } from "../reading/marketplace-registry-reading.js";

/** Whether a host's cached directory may be deleted, and when it may not, the warning that names
 * why it stays. */
export type PurgeVerdict =
  | { readonly purge: true }
  | { readonly purge: false; readonly warning: string };

const PURGE: PurgeVerdict = { purge: true };

function keep(warning: string): PurgeVerdict {
  return { purge: false, warning };
}

/** A removal the host's own CLI did not confirm never purges what it left behind. */
export function judgeConfirmation(
  label: string,
  candidate: string,
  confirmed: boolean
): PurgeVerdict {
  return confirmed
    ? PURGE
    : keep(`${label} left in place, its own removal was not confirmed: ${candidate}`);
}

/** Emptiness proves no data would be lost, never that the caller emptied it: it is only ever
 * read alongside a confirmed removal. */
export function judgeEmptiness(label: string, candidate: string, entryCount: number): PurgeVerdict {
  return entryCount > 0
    ? keep(`${label} left in place, it still holds ${entryCount} file(s): ${candidate}`)
    : PURGE;
}

/**
 * Fail-closed: a purge happens on exactly two answers, the registry never existed, or it exists
 * and no longer names `hostName`. Anything else, `unreadable` included, keeps the cache and names
 * why.
 */
export function judgeRegistryClearance(
  target: { readonly binary: string; readonly hostName: string; readonly candidate: string },
  reading: HostMarketplaceRegistryReading
): PurgeVerdict {
  const { binary, hostName, candidate } = target;
  if (reading.absent === true) return PURGE;
  if (reading.entries === undefined)
    return keep(
      `${binary}: plugin cache left in place, its registry could not be read: ${reading.location}`
    );
  return reading.entries.has(hostName)
    ? keep(
        `${binary}: cache for '${hostName}' left in place, ${reading.location} still names it: ${candidate}`
      )
    : PURGE;
}
