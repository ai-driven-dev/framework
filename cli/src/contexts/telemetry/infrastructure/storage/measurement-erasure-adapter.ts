import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { DAY_FILE, type LegacyLocations } from "../../domain/legacy/legacy-locations.js";
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

async function fileEntry(
  kind: "identity" | "previous-day-file" | "previous-identity",
  path: string
): Promise<ErasureEntry[]> {
  return (await isFile(path)) ? [{ kind, path, files: 1 }] : [];
}

/** Both versions' measurement, by the names each used and no other. The telemetry directory
 * itself is never removed: it may be one a person named, holding more than this. */
export class MeasurementErasureAdapter implements MeasurementErasure {
  constructor(
    private readonly telemetryDir: string,
    private readonly previous: LegacyLocations
  ) {}

  /** In the order they go: the ledger last, because its lock is inside it and holds until the
   * rest has gone. */
  async inventory(): Promise<readonly ErasureEntry[]> {
    return [
      ...(await directoryEntry("bindings", join(this.telemetryDir, "bindings"))),
      ...(await fileEntry("identity", join(this.telemetryDir, "identity.json"))),
      ...(await this.previousDayFiles()),
      ...(await this.previousIdentities()),
      ...(await directoryEntry("ledger", join(this.telemetryDir, "ledger"))),
    ];
  }

  private async previousDayFiles(): Promise<ErasureEntry[]> {
    const found: ErasureEntry[] = [];
    for (const dir of this.previous.sinkDirs) {
      for (const name of (await entriesOf(dir)).filter((entry) => DAY_FILE.test(entry)).sort()) {
        found.push(...(await fileEntry("previous-day-file", join(dir, name))));
      }
    }
    return found;
  }

  private async previousIdentities(): Promise<ErasureEntry[]> {
    const found: ErasureEntry[] = [];
    for (const path of this.previous.identityFiles) {
      found.push(...(await fileEntry("previous-identity", path)));
    }
    return found;
  }

  async erase(): Promise<void> {
    for (const entry of await this.inventory()) {
      await rm(entry.path, { recursive: true, force: true });
    }
  }
}
