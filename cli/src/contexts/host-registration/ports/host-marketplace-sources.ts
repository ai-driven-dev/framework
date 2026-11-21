import type { NativeMarketplaceSourceReading } from "../domain/record/native-marketplace-source-reading.js";

export interface HostMarketplaceSources {
  read(projectRoot: string): Promise<NativeMarketplaceSourceReading>;
}
