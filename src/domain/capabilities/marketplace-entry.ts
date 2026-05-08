import type { MarketplaceSettingsEntry, MarketplaceSettingsInput } from "./plugins-capability.js";

/**
 * Shared toEntry implementation for tools that use the Claude Code marketplace schema:
 *   { source: { source: "github"|"directory", repo/path: "..." }, version? }
 *
 * Used by: claude, copilot (same .github/copilot/settings.json spec as .claude/settings.json)
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
  return { key: name, value };
}
