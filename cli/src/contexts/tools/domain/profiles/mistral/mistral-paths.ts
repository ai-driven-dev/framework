/**
 * Canonical path constants for the Mistral Vibe workspace layout.
 *
 * Exported from a dedicated file so `profile.ts` (tool definition) and the build
 * contracts import from a single source of truth, without introducing a
 * cross-layer dependency.
 */

/** Root directory for all Mistral Vibe workspace files. */
export const MISTRAL_WORKSPACE_DIR = ".vibe/";

/** Workspace-level MCP configuration path for Mistral Vibe. */
export const MISTRAL_MCP_PATH = ".vibe/mcp.json";

/**
 * Mistral Vibe build output path constants.
 *
 * These constants are intentionally distinct from their source-side equivalents
 * even when the literal values coincide. Future changes to either side must not
 * collapse them.
 */

/** Relative path for the Mistral Vibe-native plugin manifest inside each plugin output directory. */
export const OUTPUT_MISTRAL_MANIFEST_RELATIVE = ".vibe-plugin/plugin.json";

/** Relative path for the Mistral Vibe marketplace catalog in the vibe output tree. */
export const OUTPUT_MISTRAL_MARKETPLACE_RELATIVE = ".vibe-plugin/marketplace.json";

/** Why a Mistral Vibe build or install delivers no hooks. */
export const MISTRAL_HOOKS_SKIP_REASON =
  "Vibe loads .vibe/hooks.toml (pre_tool/post_tool/post_agent); SessionStart has no equivalent";
