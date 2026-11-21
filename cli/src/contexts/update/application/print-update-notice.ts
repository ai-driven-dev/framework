import type { VersionReader } from "../../../shared/ports/version-reader.js";
import { noticeFor, type UpdateNotice } from "../domain/update-notice.js";
import type { UpdateCheckCache } from "../ports/update-check-cache.js";

/** The newer release to tell of, none when there is nothing to say. */
export interface PrintUpdateNoticeResult {
  notice: UpdateNotice | null;
}

/** The hot path: what the last check kept, fresh or stale, never the network. */
export class PrintUpdateNotice {
  constructor(
    private readonly cache: UpdateCheckCache,
    private readonly version: VersionReader
  ) {}

  async execute(): Promise<PrintUpdateNoticeResult> {
    const entry = await this.cache.read();
    if (entry === null) return { notice: null };
    return { notice: noticeFor(entry, this.version.get()) };
  }
}
