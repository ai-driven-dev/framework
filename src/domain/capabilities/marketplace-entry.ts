import type { MarketplaceSettingsEntry, MarketplaceSettingsInput } from "./plugins-capability.js";

/**
 * Shared toEntry implementation for tools that use the Claude Code marketplace schema:
 *   { source: { source: "github"|"directory", repo/path: "..." }, version? }
 *
 * Used by: claude, cursor, codex
 */
export function buildClaudeStyleMarketplaceEntry(
  input: MarketplaceSettingsInput
): MarketplaceSettingsEntry | null {
  const { name, source, version } = input;
  const value: Record<string, unknown> = {};

  if (source.kind === "local") {
    value.source = { source: "directory", path: source.path };
  } else if (source.kind === "github") {
    const githubSource: Record<string, unknown> = { source: "github", repo: source.repo };
    if (source.ref != null) githubSource.ref = source.ref;
    value.source = githubSource;
  } else {
    return null;
  }

  if (version != null) value.version = version;
  return { valueShape: "map", key: name, value };
}

/**
 * toEntry implementation for VSCode Copilot chat.plugins.marketplaces (array of strings).
 * GitHub source: "owner/repo" shorthand.
 * Local source: "file:///abs/path" URI.
 *
 * Used by: copilot
 */
export function buildVscodeStyleMarketplaceEntry(
  input: MarketplaceSettingsInput
): MarketplaceSettingsEntry | null {
  const { source } = input;
  if (source.kind === "github") {
    return { valueShape: "array", value: source.repo };
  }
  if (source.kind === "local") {
    return { valueShape: "array", value: `file://${source.path}` };
  }
  return null;
}
