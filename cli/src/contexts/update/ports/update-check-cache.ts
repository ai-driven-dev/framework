import type { CheckEntry } from "../domain/update-notice.js";

/** What the last check learned, kept between two runs. */
export interface UpdateCheckCache {
  /** `null` where nothing was kept or what was kept cannot be read. */
  read(): Promise<CheckEntry | null>;
  write(entry: CheckEntry): Promise<void>;
}
