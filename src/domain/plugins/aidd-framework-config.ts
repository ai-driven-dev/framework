import { join } from "node:path";
import { PATHS } from "../../infra/constants/paths.js";
import type { PluginConfig } from "../install/plugin-config.js";
import { POLICY_IDS } from "../policies/policy-ids.js";

/**
 * AIDD Framework Plugin Configuration
 * Installs the complete AIDD framework structure using HardCopyPolicy
 * This is a required plugin that makes projects self-contained and portable
 */
export const aiddFrameworkPlugin: PluginConfig = {
	id: "aidd-framework",
	name: "AIDD Framework",
	description:
		"Complete AIDD framework structure (prompts, templates, supports, sub-agents)",
	required: true,
	shouldInstall: async (context) => {
		// Skip installation if --skip-framework is specified
		return !context.options.skipFramework;
	},
	policies: [
		{
			policyId: POLICY_IDS.COPY_HARD,
			source: "aidd", // Points to dist/assets/aidd (the framework root)
			target: join(PATHS.AIDD_ROOT),
			options: {}, // Copy everything - no filters needed
		},
	],
	// Validation is handled by the HardCopyPolicy - no custom validation needed
	// The policy will ensure all components are properly copied to the target location
};
