import { join } from "node:path";
import { PATHS } from "../../infra/constants/paths.js";
import type { PluginConfig } from "../install/plugin-config.js";
import { POLICY_IDS } from "../policies/policy-ids.js";

/**
 * Claude Code Plugin Configuration
 * Installs Claude Code integration (commands, agents, settings, flows)
 * Depends on aidd-framework for the core structure
 */
export function createClaudeCodePlugin(): PluginConfig {
	return {
		id: "claude-code",
		name: "Claude Code",
		description: "Claude Code integration (.claude/)",
		dependencies: ["aidd-framework"],
		policies: [
			// Symlink IDE commands to prompts/ide for live updates
			{
				policyId: POLICY_IDS.SYMLINK_RELATIVE,
				source: join(PATHS.AIDD_ROOT, "ide", "prompts"),
				target: PATHS.CLAUDE_COMMANDS_IDE,
				options: {},
			},
			// Symlink sub-agents to sub-agents directory for live updates
			{
				policyId: POLICY_IDS.SYMLINK_RELATIVE,
				source: join(PATHS.PROJECT_DOCS_DIR, "agents"),
				target: PATHS.CLAUDE_AGENTS,
				options: {},
			},
			// Merge settings.json (user settings take precedence, creates file if missing)
			{
				policyId: POLICY_IDS.MERGE_JSON,
				source: "aidd/config/.claude/settings.json",
				target: PATHS.CLAUDE_SETTINGS,
				options: {
					userFirst: true,
					arrayUnion: true,
				},
			},
			// Symlink flows commands to docs/flows
			{
				policyId: POLICY_IDS.SYMLINK_RELATIVE,
				source: join(PATHS.PROJECT_DOCS_DIR, "flows"),
				target: PATHS.CLAUDE_COMMANDS_FLOWS,
				options: {},
			},
			// Symlink custom prompts to docs/prompts
			{
				policyId: POLICY_IDS.SYMLINK_RELATIVE,
				source: join(PATHS.PROJECT_DOCS_DIR, "prompts"),
				target: PATHS.CLAUDE_COMMANDS_CUSTOM,
				options: {},
			},
			// Create CLAUDE.md symlink pointing to AGENTS.md at project root for Claude Code integration
			{
				policyId: POLICY_IDS.SYMLINK_RELATIVE,
				source: "AGENTS.md",
				target: PATHS.CLAUDE_MD,
				options: {},
			},
			// Copy MCP configuration file
			{
				policyId: POLICY_IDS.COPY_HARD,
				source: "aidd/mcp.json",
				target: PATHS.CLAUDE_MCP,
				options: {},
			},
		],
	};
}
