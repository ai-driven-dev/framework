import type { FileHash } from "../../../../shared/domain/file.js";

export type DriftVerdict = "ok" | "missing" | "modified";

/**
 * Compares the digest the manifest recorded for a file with the hash the disk holds now, `null`
 * for an absent file. The recorded side is the raw string: a manifest never validated it at load,
 * so a malformed one reads as modified instead of throwing.
 */
export function driftOf(recordedDigest: string, onDisk: FileHash | null): DriftVerdict {
  if (onDisk === null) return "missing";
  return recordedDigest === onDisk.value ? "ok" : "modified";
}

/**
 * Drift of a merge file, through the keys the manifest recorded only: a key the user added is
 * theirs. `onDisk` is `null` for an absent file.
 */
export function driftOfKeys(
  recorded: Readonly<Record<string, FileHash>>,
  onDisk: Readonly<Record<string, FileHash>> | null
): DriftVerdict {
  if (onDisk === null) return "missing";
  const keysOk = Object.entries(recorded).every(
    ([key, hash]) => driftOf(hash.value, onDisk[key] ?? null) === "ok"
  );
  return keysOk ? "ok" : "modified";
}
