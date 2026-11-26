import type { NativeMarketplaceSourceReading } from "../domain/record/native-marketplace-source-reading.js";

export interface HostMarketplaceSources {
  /** Never rejects: a failure is typed as `unreadable` on the reading. */
  read(projectRoot: string): Promise<NativeMarketplaceSourceReading>;
}
