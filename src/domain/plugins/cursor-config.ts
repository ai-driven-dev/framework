import { join } from "node:path";
import { PATHS } from "../../infra/constants/paths.js";
import type { PluginConfig } from "../install/plugin-config.js";
import { POLICY_IDS } from "../policies/policy-ids.js";

/**
 * Cursor Plugin Configuration Factory
 * Installs Cursor integration with symlinked rules and commands
 * Creates relative symlinks from project-specific docs to .cursor/
 * Mirrors Claude Code command structure for consistent workflows
 */
export function createCursorPlugin(): PluginConfig {
	return {
		id: "cursor",
		name: "Cursor",
		description: "Cursor integration (.cursor/rules, .cursor/commands)",
		dependencies: ["aidd-framework"],
		policies: [
			// Create the symlink from .cursor/rules to docs/rules
			{
				policyId: POLICY_IDS.SYMLINK_RELATIVE,
				source: join(PATHS.PROJECT_DOCS_DIR, "rules"),
				target: PATHS.CURSOR_RULES,
				options: {
					interactiveMode: true,
					warnOnExistingNonAiddFiles: true,
				},
			},
			// Symlink IDE commands to aidd/ide/prompts
			{
				policyId: POLICY_IDS.SYMLINK_RELATIVE,
				source: join(PATHS.AIDD_ROOT, "ide", "prompts"),
				target: PATHS.CURSOR_COMMANDS_IDE,
				options: {},
			},
			// Symlink flows commands to docs/flows
			{
				policyId: POLICY_IDS.SYMLINK_RELATIVE,
				source: join(PATHS.PROJECT_DOCS_DIR, "flows"),
				target: PATHS.CURSOR_COMMANDS_FLOWS,
				options: {},
			},
			// Symlink custom prompts to docs/prompts
			{
				policyId: POLICY_IDS.SYMLINK_RELATIVE,
				source: join(PATHS.PROJECT_DOCS_DIR, "prompts"),
				target: PATHS.CURSOR_COMMANDS_CUSTOM,
				options: {},
			},
		],
	};
}
