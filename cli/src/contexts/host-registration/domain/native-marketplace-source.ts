/** Source currently selected by the host for a named native plugin marketplace. */
export type NativeMarketplaceSource =
  | { readonly kind: "registry"; readonly source: string }
  | {
      readonly kind: "effective-list";
      readonly root: string;
      readonly sourceType: string;
      readonly source: string;
    };

export function sameNativeMarketplaceSource(
  recorded: NativeMarketplaceSource,
  current: NativeMarketplaceSource
): boolean {
  return JSON.stringify(identityOf(recorded)) === JSON.stringify(identityOf(current));
}

/** What makes two sources one: a registry source is its source alone, an effective list adds
 * where it is rooted and what kind it is. */
function identityOf(source: NativeMarketplaceSource): readonly string[] {
  return source.kind === "registry"
    ? [source.kind, source.source]
    : [source.kind, source.source, source.root, source.sourceType];
}
