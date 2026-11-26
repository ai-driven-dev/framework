import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ErasureEntry, MeasurementErasure } from "../../ports/forget/measurement-erasure.js";
import { isAbsent } from "../reading/text-file.js";

async function entriesOf(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (error) {
    if (isAbsent(error)) return [];
    throw error;
  }
}

async function kindOf(path: string): Promise<"file" | "directory" | null> {
  try {
    const found = await stat(path);
    return found.isFile() ? "file" : found.isDirectory() ? "directory" : null;
  } catch (error) {
    if (isAbsent(error)) return null;
    throw error;
  }
}

async function isFile(path: string): Promise<boolean> {
  return (await kindOf(path)) === "file";
}

/** The ledger's lock is held by whoever is counting: it is not something that was measured. */
const LOCK_FILE = ".lock";

async function filesUnder(dir: string): Promise<number> {
  let count = 0;
  for (const name of (await entriesOf(dir)).filter((entry) => entry !== LOCK_FILE)) {
    const path = join(dir, name);
    count += (await isFile(path)) ? 1 : await filesUnder(path);
  }
  return count;
}

async function directoryEntry(kind: "bindings" | "ledger", path: string): Promise<ErasureEntry[]> {
  return (await kindOf(path)) === "directory"
    ? [{ kind, path, files: await filesUnder(path) }]
    : [];
}

async function fileEntry(kind: "identity", path: string): Promise<ErasureEntry[]> {
  return (await isFile(path)) ? [{ kind, path, files: 1 }] : [];
}

/** This version's measurement, by the names it uses and no other. The telemetry directory
 * itself is never removed: it may be one a person named, holding more than this. */
export class MeasurementErasureAdapter implements MeasurementErasure {
  constructor(private readonly telemetryDir: string) {}

  /** In the order they go: the ledger last, because its lock is inside it and holds until the
   * rest has gone. */
  async inventory(): Promise<readonly ErasureEntry[]> {
    return [
      ...(await directoryEntry("bindings", join(this.telemetryDir, "bindings"))),
      ...(await fileEntry("identity", join(this.telemetryDir, "identity.json"))),
      ...(await directoryEntry("ledger", join(this.telemetryDir, "ledger"))),
    ];
  }

  async erase(): Promise<void> {
    for (const entry of await this.inventory()) {
      await rm(entry.path, { recursive: true, force: true });
    }
  }
}
