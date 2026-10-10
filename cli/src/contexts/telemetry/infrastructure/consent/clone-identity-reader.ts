import { stat } from "node:fs/promises";
import { isErrnoException } from "../../../../kernel/reading/json-file.js";
import { type CloneIdentity, identityFromStat } from "../../domain/consent/clone-identity.js";

const ABSENT = new Set(["ENOENT", "ENOTDIR"]);

/** What the directory at a path is now: see `readCloneIdentity`. */
export type CloneIdentityReader = (path: string) => Promise<CloneIdentity | "unidentified" | null>;

/** What the directory at a path is now: its identity, `null` when there is no such directory,
 * and `unidentified` for anything else: the platform gives it none, or it cannot be looked at
 * (a folder the system protects, a share that is not mounted). A clone nobody can look at is
 * not known to be gone, so one such directory never fails a run, and the identity is asked of
 * the real path, in `bigint` so that a Windows file index is not rounded. */
export const readCloneIdentity: CloneIdentityReader = async (path) => {
  try {
    return identityFromStat(path, await stat(path, { bigint: true })) ?? "unidentified";
  } catch (error) {
    if (isErrnoException(error) && ABSENT.has(error.code ?? "")) return null;
    return "unidentified";
  }
};
