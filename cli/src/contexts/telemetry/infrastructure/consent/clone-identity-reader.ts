import { stat } from "node:fs/promises";
import { isErrnoException } from "../../../../kernel/reading/json-file.js";
import { type CloneIdentity, identityFromStat } from "../../domain/consent/clone-identity.js";

const ABSENT = new Set(["ENOENT", "ENOTDIR"]);

/** What the directory at a path is now: see `readCloneIdentity`. */
export type CloneIdentityReader = (path: string) => Promise<CloneIdentity | "unidentified" | null>;

/** What the directory at a path is now: its identity, `unidentified` when the platform gives it
 * none, or `null` when there is no such directory. The identity is asked of the real path, in `bigint` so that a
 * Windows file index is not rounded. */
export const readCloneIdentity: CloneIdentityReader = async (path) => {
  try {
    return identityFromStat(path, await stat(path, { bigint: true })) ?? "unidentified";
  } catch (error) {
    if (isErrnoException(error) && ABSENT.has(error.code ?? "")) return null;
    throw error;
  }
};
