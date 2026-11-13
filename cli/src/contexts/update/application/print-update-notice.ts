import type { VersionReader } from "../../../shared/ports/version-reader.js";
import { noticeFor } from "../domain/update-notice.js";
import type { UpdateCheckCache } from "../ports/update-check-cache.js";

/** The lines to show, none when there is nothing to say. */
export interface PrintUpdateNoticeResult {
  lines: string[];
}

/** The hot path: what the last check kept, fresh or stale, never the network. */
export class PrintUpdateNotice {
  constructor(
    private readonly cache: UpdateCheckCache,
    private readonly version: VersionReader
  ) {}

  async execute(): Promise<PrintUpdateNoticeResult> {
    const entry = await this.cache.read();
    if (entry === null) return { lines: [] };
    return { lines: noticeFor(entry, this.version.get()) };
  }
}
