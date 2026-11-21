import type {
  MarketplaceListLayout,
  MarketplaceSourcesDeclaration,
} from "../../tools/contract/native-registration-spec.js";
import type { NativeMarketplaceSource } from "../domain/record/native-marketplace-source.js";
import type { NativeMarketplaceSourceListContract } from "./native-marketplace-source-list-contract.js";

type Sources = ReadonlyMap<string, NativeMarketplaceSource | null>;

/** Reads a host's marketplace list; `hostLabel` names the host in what a parse refuses. */
export type MarketplaceListParser = (hostLabel: string, output: string) => Sources;

const LOCAL_SOURCE_PREFIX = "Local: ";

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

const isText = (value: unknown): value is string => typeof value === "string" && value !== "";

/** One `{ name, root, marketplaceSource? }` row: its name and the source it proves, if any. */
function withSourceRow(
  hostLabel: string,
  item: unknown,
  seen: Sources
): [string, NativeMarketplaceSource | null] {
  const row = object(item);
  if (!isText(row?.name) || !isText(row.root) || seen.has(row.name))
    throw new Error(`ambiguous ${hostLabel} marketplace JSON row`);
  if (row.marketplaceSource === undefined) return [row.name, null];
  const sourceRow = object(row.marketplaceSource);
  if (!isText(sourceRow?.sourceType) || !isText(sourceRow.source))
    throw new Error(`unproven ${hostLabel} marketplace source shape`);
  return [
    row.name,
    {
      kind: "effective-list",
      root: row.root,
      sourceType: sourceRow.sourceType,
      source: sourceRow.source,
    },
  ];
}

/** `{ marketplaces: [{ name, root, marketplaceSource?: { sourceType, source } }] }`. A row
 * without `marketplaceSource` is named but unproven. */
export const parseMarketplacesWithSource: MarketplaceListParser = (hostLabel, output) => {
  const parsed = object(JSON.parse(output));
  if (!Array.isArray(parsed?.marketplaces)) throw new Error(`unexpected ${hostLabel} JSON shape`);
  const entries = new Map<string, NativeMarketplaceSource | null>();
  for (const item of parsed.marketplaces) {
    const [name, source] = withSourceRow(hostLabel, item, entries);
    entries.set(name, source);
  }
  return entries;
};

/** One `{ name, source }` row: its name and the local path its source reads, if it is local. */
function nameSourceRow(
  hostLabel: string,
  item: unknown,
  seen: Sources
): [string, NativeMarketplaceSource | null] {
  if (item === null || typeof item !== "object") throw new Error(`ambiguous ${hostLabel} JSON row`);
  const { name, source } = item as Record<string, unknown>;
  if (!isText(name) || typeof source !== "string" || seen.has(name))
    throw new Error(`ambiguous ${hostLabel} marketplace JSON row`);
  const path = source.startsWith(LOCAL_SOURCE_PREFIX)
    ? source.slice(LOCAL_SOURCE_PREFIX.length)
    : "";
  return [
    name,
    path === "" ? null : { kind: "effective-list", root: path, sourceType: "local", source: path },
  ];
}

/**
 * `[{ name, source, isDefault }]`, `source` reading `Local: <path>` or `GitHub: <owner/repo>`.
 * Only a local source is proven; any other stays named but unproven.
 */
export const parseNameSourceRows: MarketplaceListParser = (hostLabel, output) => {
  const parsed: unknown = JSON.parse(output);
  if (!Array.isArray(parsed)) throw new Error(`unexpected ${hostLabel} JSON shape`);
  const entries = new Map<string, NativeMarketplaceSource | null>();
  for (const item of parsed) {
    const [name, source] = nameSourceRow(hostLabel, item, entries);
    entries.set(name, source);
  }
  return entries;
};

const LIST_PARSERS = {
  "marketplaces-with-source": parseMarketplacesWithSource,
  "name-source-rows": parseNameSourceRows,
} satisfies Record<MarketplaceListLayout, MarketplaceListParser>;

/** The list-command contract one host's declaration describes, its parser chosen by layout. */
export function marketplaceListContract(
  binary: string,
  sources: Extract<MarketplaceSourcesDeclaration, { from: "list-command" }>
): NativeMarketplaceSourceListContract {
  const parse = LIST_PARSERS[sources.layout];
  return {
    binary,
    args: sources.args,
    parse: (output) => parse(sources.hostLabel, output),
    unavailableMessage: sources.unavailableMessage,
    unverifiedMessage: sources.unverifiedMessage,
  };
}
