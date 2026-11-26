/** Builds the tree one catalog is registered from; `null` when it cannot be built. */
export type BuiltCatalogs<Catalog> = (catalog: Catalog) => Promise<string | null>;
