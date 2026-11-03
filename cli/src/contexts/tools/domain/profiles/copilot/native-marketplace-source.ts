import type {
  NativeMarketplaceSource,
  NativeMarketplaceSourceListContract,
} from "../../ports/native-marketplace-source-reader.js";

const LOCAL_SOURCE_PREFIX = "Local: ";

/**
 * Copilot 1.0.98 answers `--json` with `[{ name, source, isDefault }]`, `source` reading
 * `Local: <path>` or `GitHub: <owner/repo>`. Only a local source is proven; any other stays
 * named but unproven. Installed Copilot 1.0.83 rejects `--json` and stays unreadable.
 */
function parseCopilotMarketplaceSources(
  output: string
): ReadonlyMap<string, NativeMarketplaceSource | null> {
  const parsed: unknown = JSON.parse(output);
  if (!Array.isArray(parsed)) throw new Error("unexpected Copilot JSON shape");
  const entries = new Map<string, NativeMarketplaceSource | null>();
  for (const item of parsed) {
    const row: unknown = item;
    if (row === null || typeof row !== "object") throw new Error("ambiguous Copilot JSON row");
    const { name, source } = row as Record<string, unknown>;
    if (typeof name !== "string" || name === "" || typeof source !== "string" || entries.has(name))
      throw new Error("ambiguous Copilot marketplace JSON row");
    const path = source.startsWith(LOCAL_SOURCE_PREFIX)
      ? source.slice(LOCAL_SOURCE_PREFIX.length)
      : "";
    entries.set(
      name,
      path === "" ? null : { kind: "effective-list", root: path, sourceType: "local", source: path }
    );
  }
  return entries;
}

export const copilotMarketplaceSourceListContract: NativeMarketplaceSourceListContract = {
  binary: "copilot",
  args: ["plugin", "marketplace", "list", "--json"],
  parse: parseCopilotMarketplaceSources,
  unavailableMessage:
    "Copilot CLI marketplace list --json unavailable; upgrade to a supported binary and retry",
  unverifiedMessage:
    "Copilot CLI marketplace list --json output shape is not verified; upgrade to a supported binary and reconcile manually",
};
