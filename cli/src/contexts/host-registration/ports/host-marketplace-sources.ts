import type { NativeMarketplaceSourceReading } from "../domain/native-marketplace-source-reading.js";

export interface HostMarketplaceSources {
  read(projectRoot: string): Promise<NativeMarketplaceSourceReading>;
}
