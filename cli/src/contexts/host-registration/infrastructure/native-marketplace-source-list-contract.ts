import type { NativeMarketplaceSource } from "../domain/native-marketplace-source.js";

export interface NativeMarketplaceSourceListContract {
  readonly binary: string;
  readonly args: readonly string[];
  readonly parse?: (output: string) => ReadonlyMap<string, NativeMarketplaceSource | null>;
  readonly unavailableMessage: string;
  readonly unverifiedMessage: string;
}
