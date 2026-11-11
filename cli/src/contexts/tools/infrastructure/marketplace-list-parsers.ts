import type { NativeMarketplaceSource } from "../domain/ports/native-marketplace-source-reader.js";

type Sources = ReadonlyMap<string, NativeMarketplaceSource | null>;

/** Reads a host's marketplace list; `hostLabel` names the host in what a parse refuses. */
export type MarketplaceListParser = (hostLabel: string, output: string) => Sources;

const LOCAL_SOURCE_PREFIX = "Local: ";

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** `{ marketplaces: [{ name, root, marketplaceSource?: { sourceType, source } }] }`. A row
 * without `marketplaceSource` is named but unproven. */
export const parseMarketplacesWithSource: MarketplaceListParser = (hostLabel, output) => {
  const parsed = object(JSON.parse(output));
  if (!Array.isArray(parsed?.marketplaces)) throw new Error(`unexpected ${hostLabel} JSON shape`);
  const entries = new Map<string, NativeMarketplaceSource | null>();
  for (const item of parsed.marketplaces) {
    const row = object(item);
    if (
      typeof row?.name !== "string" ||
      row.name === "" ||
      typeof row.root !== "string" ||
      row.root === "" ||
      entries.has(row.name)
    )
      throw new Error(`ambiguous ${hostLabel} marketplace JSON row`);
    const source = row.marketplaceSource;
    if (source === undefined) {
      entries.set(row.name, null);
      continue;
    }
    const sourceRow = object(source);
    if (
      typeof sourceRow?.sourceType !== "string" ||
      sourceRow.sourceType === "" ||
      typeof sourceRow.source !== "string" ||
      sourceRow.source === ""
    )
      throw new Error(`unproven ${hostLabel} marketplace source shape`);
    entries.set(row.name, {
      kind: "effective-list",
      root: row.root,
      sourceType: sourceRow.sourceType,
      source: sourceRow.source,
    });
  }
  return entries;
};

/**
 * `[{ name, source, isDefault }]`, `source` reading `Local: <path>` or `GitHub: <owner/repo>`.
 * Only a local source is proven; any other stays named but unproven.
 */
export const parseNameSourceRows: MarketplaceListParser = (hostLabel, output) => {
  const parsed: unknown = JSON.parse(output);
  if (!Array.isArray(parsed)) throw new Error(`unexpected ${hostLabel} JSON shape`);
  const entries = new Map<string, NativeMarketplaceSource | null>();
  for (const item of parsed) {
    const row: unknown = item;
    if (row === null || typeof row !== "object") throw new Error(`ambiguous ${hostLabel} JSON row`);
    const { name, source } = row as Record<string, unknown>;
    if (typeof name !== "string" || name === "" || typeof source !== "string" || entries.has(name))
      throw new Error(`ambiguous ${hostLabel} marketplace JSON row`);
    const path = source.startsWith(LOCAL_SOURCE_PREFIX)
      ? source.slice(LOCAL_SOURCE_PREFIX.length)
      : "";
    entries.set(
      name,
      path === "" ? null : { kind: "effective-list", root: path, sourceType: "local", source: path }
    );
  }
  return entries;
};
