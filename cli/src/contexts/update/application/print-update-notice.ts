import type { Logger } from "../../../kernel/ports/logger.js";
import type { VersionReader } from "../../../kernel/ports/version-reader.js";
import { noticeFor } from "../domain/update-notice.js";
import type { UpdateCheckCache } from "../ports/update-check-cache.js";

/** The hot path: what the last check kept, fresh or stale, never the network. */
export class PrintUpdateNotice {
  constructor(
    private readonly cache: UpdateCheckCache,
    private readonly version: VersionReader,
    private readonly logger: Logger
  ) {}

  async execute(): Promise<void> {
    const entry = await this.cache.read();
    if (entry === null) return;
    for (const line of noticeFor(entry, this.version.get())) this.logger.warn(line);
  }
}
