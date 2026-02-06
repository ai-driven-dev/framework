import { PATHS } from "../../infra/constants/paths.js";
import type { PluginConfig } from "../install/plugin-config.js";
import { POLICY_IDS } from "../policies/policy-ids.js";

/**
 * Windsurf Plugin Configuration
 * Installs Windsurf integration with symlinked rules
 * Creates a relative symlink from project-specific docs/rules to .windsurf/rules
 */
export const windsurfPlugin: PluginConfig = {
	id: "windsurf",
	name: "Windsurf",
	description:
		"Windsurf integration (.windsurf/rules, .windsurf/global_rules.md)",
	dependencies: [], // No dependencies needed
	policies: [
		{
			policyId: POLICY_IDS.SYMLINK_RELATIVE,
			source: "docs/rules", // Project-specific rules directory
			target: PATHS.WINDSURF_RULES,
			options: {
				interactiveMode: true,
				warnOnExistingNonAiddFiles: true,
			},
		},
		{
			policyId: POLICY_IDS.SYMLINK_RELATIVE,
			source: "AGENTS.md",
			target: PATHS.WINDSURF_GLOBAL_RULES,
			options: {},
		},
	],
};
