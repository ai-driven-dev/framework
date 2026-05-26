/**
 * Codex build output path constants.
 *
 * These constants are intentionally distinct from their source-side equivalents
 * even when the literal values coincide (e.g. OUTPUT_CODEX_MARKETPLACE_RELATIVE
 * mirrors SOURCE_MARKETPLACE_RELATIVE). Future changes to either side must not
 * collapse them.
 */

/** Relative path for the Codex-native plugin manifest inside each plugin output directory. */
export const OUTPUT_CODEX_MANIFEST_RELATIVE = ".codex-plugin/plugin.json";

/**
 * Relative path for the Claude-shaped marketplace catalog in the codex output tree.
 * Codex auto-discovers this path at the repo root (legacy compat per docs).
 */
export const OUTPUT_CODEX_MARKETPLACE_RELATIVE = ".claude-plugin/marketplace.json";

/** Subdirectory name inside each plugin output for staged Codex agent TOML files. */
export const OUTPUT_CODEX_AGENTS_DIR = "codex-agents";
