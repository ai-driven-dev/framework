import type { CheckEntry } from "../../../../src/contexts/update/domain/update-notice.js";
import type { UpdateCheckCache } from "../../../../src/contexts/update/ports/update-check-cache.js";

/** A check cache held in memory; an entry may be seeded as unreadable. */
export class InMemoryUpdateCheckCache implements UpdateCheckCache {
  private kept: CheckEntry | "unreadable" | null;

  constructor(kept: CheckEntry | "unreadable" | null = null) {
    this.kept = kept;
  }

  async read(): Promise<CheckEntry | null> {
    return this.kept === "unreadable" ? null : this.kept;
  }

  async write(entry: CheckEntry): Promise<void> {
    this.kept = entry;
  }
}
