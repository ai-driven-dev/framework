/** Path to the source (Claude-format) plugin manifest inside each plugin directory. */
export const SOURCE_PLUGIN_MANIFEST_RELATIVE = ".claude-plugin/plugin.json";

/** Path to the source (Claude-format) marketplace catalog. */
export const SOURCE_MARKETPLACE_RELATIVE = ".claude-plugin/marketplace.json";

export const PLUGIN_HOOKS_RELATIVE = "hooks/hooks.json";
export const PLUGIN_MCP_RELATIVE = ".mcp.json";
export const PLUGIN_AGENT_INPUT_EXT = ".md";
export const PLUGIN_SKILL_ENTRY_FILE = "SKILL.md";

/** Subdirectory names a build warns about and skips. */
export const OUT_OF_SCOPE_PLUGIN_SECTIONS: readonly ["commands", "rules"] = ["commands", "rules"];
