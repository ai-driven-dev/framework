/** Source currently selected by the host for a named native plugin marketplace. */
export type NativeMarketplaceSource =
  | { readonly kind: "registry"; readonly source: string }
  | {
      readonly kind: "effective-list";
      readonly root: string;
      readonly sourceType: string;
      readonly source: string;
    };

export interface NativeMarketplaceSourceReading {
  readonly location: string;
  /** A missing name in a readable map proves absence; `null` means named but source unproven. */
  readonly entries?: ReadonlyMap<string, NativeMarketplaceSource | null>;
  /** Present only when no structured answer could be measured. */
  readonly unreadable?: string;
}

export interface NativeMarketplaceSourceReader {
  read(projectRoot: string): Promise<NativeMarketplaceSourceReading>;
}

export interface NativeMarketplaceSourceListContract {
  readonly binary: string;
  readonly args: readonly string[];
  readonly parse?: (output: string) => ReadonlyMap<string, NativeMarketplaceSource | null>;
  readonly unavailableMessage: string;
  readonly unverifiedMessage: string;
}
