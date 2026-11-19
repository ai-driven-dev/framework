import type { NativeMarketplaceSource } from "./native-marketplace-source.js";

export interface NativeMarketplaceSourceReading {
  readonly location: string;
  /** A missing name in a readable map proves absence; `null` means named but source unproven. */
  readonly entries?: ReadonlyMap<string, NativeMarketplaceSource | null>;
  /** Present only when no structured answer could be measured. */
  readonly unreadable?: string;
}
