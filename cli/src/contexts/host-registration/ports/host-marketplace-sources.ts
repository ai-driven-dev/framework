import type { NativeMarketplaceSource } from "../domain/native-marketplace-source.js";

export interface NativeMarketplaceSourceReading {
  readonly location: string;
  /** A missing name in a readable map proves absence; `null` means named but source unproven. */
  readonly entries?: ReadonlyMap<string, NativeMarketplaceSource | null>;
  /** Present only when no structured answer could be measured. */
  readonly unreadable?: string;
}

export interface HostMarketplaceSources {
  read(projectRoot: string): Promise<NativeMarketplaceSourceReading>;
}

export interface NativeMarketplaceSourceListContract {
  readonly binary: string;
  readonly args: readonly string[];
  readonly parse?: (output: string) => ReadonlyMap<string, NativeMarketplaceSource | null>;
  readonly unavailableMessage: string;
  readonly unverifiedMessage: string;
}
