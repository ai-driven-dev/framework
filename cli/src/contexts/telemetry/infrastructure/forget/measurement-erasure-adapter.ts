import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { isErrnoException } from "../../../../kernel/reading/json-file.js";
import { DAY_FILE, type LegacyLocations } from "../../domain/legacy/legacy-locations.js";
import type {
  ErasureEntry,
  MeasurementErasure,
} from "../../domain/ports/forget/measurement-erasure.js";

const ABSENT = new Set(["ENOENT", "ENOTDIR"]);

async function entriesOf(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (error) {
    if (isErrnoException(error) && ABSENT.has(error.code ?? "")) return [];
    throw error;
  }
}

async function kindOf(path: string): Promise<"file" | "directory" | null> {
  try {
    const found = await stat(path);
    return found.isFile() ? "file" : found.isDirectory() ? "directory" : null;
  } catch (error) {
    if (isErrnoException(error) && ABSENT.has(error.code ?? "")) return null;
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
    const found: ErasureEntry[] = [];
    const bindings = join(this.telemetryDir, "bindings");
    if ((await kindOf(bindings)) === "directory") {
      found.push({ kind: "bindings", path: bindings, files: await filesUnder(bindings) });
    }
    const identity = join(this.telemetryDir, "identity.json");
    if (await isFile(identity)) found.push({ kind: "identity", path: identity, files: 1 });
    for (const dir of this.previous.sinkDirs) {
      for (const name of (await entriesOf(dir)).filter((entry) => DAY_FILE.test(entry)).sort()) {
        const path = join(dir, name);
        if (await isFile(path)) found.push({ kind: "previous-day-file", path, files: 1 });
      }
    }
    for (const path of this.previous.identityFiles) {
      if (await isFile(path)) found.push({ kind: "previous-identity", path, files: 1 });
    }
    const ledger = join(this.telemetryDir, "ledger");
    if ((await kindOf(ledger)) === "directory") {
      found.push({ kind: "ledger", path: ledger, files: await filesUnder(ledger) });
    }
    return found;
  }

  async erase(): Promise<void> {
    for (const entry of await this.inventory()) {
      await rm(entry.path, { recursive: true, force: true });
    }
  }
}
