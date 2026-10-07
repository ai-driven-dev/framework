import type {
  NativeMarketplaceSource,
  NativeMarketplaceSourceListContract,
} from "../../ports/native-marketplace-source-reader.js";

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseCodexMarketplaceSources(
  output: string
): ReadonlyMap<string, NativeMarketplaceSource | null> {
  const parsed = object(JSON.parse(output));
  if (!Array.isArray(parsed?.marketplaces)) throw new Error("unexpected Codex JSON shape");
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
      throw new Error("ambiguous Codex marketplace JSON row");
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
      throw new Error("unproven Codex marketplace source shape");
    entries.set(row.name, {
      kind: "effective-list",
      root: row.root,
      sourceType: sourceRow.sourceType,
      source: sourceRow.source,
    });
  }
  return entries;
}

export const codexMarketplaceSourceListContract: NativeMarketplaceSourceListContract = {
  binary: "codex",
  args: ["plugin", "marketplace", "list", "--json"],
  parse: parseCodexMarketplaceSources,
  unavailableMessage: "Codex marketplace list --json unavailable; inspect the host CLI and retry",
  unverifiedMessage: "Codex marketplace list --json output shape is not verified",
};
