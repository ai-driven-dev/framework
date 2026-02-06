import { PATHS } from "../../infra/constants/paths.js";
import type { PluginConfig } from "../install/plugin-config.js";
import { POLICY_IDS } from "../policies/policy-ids.js";

/**
 * VCS template symlinks following GitHub conventions
 */
const VCS_TEMPLATE_SYMLINKS = [
	{
		source: PATHS.DOCS_TEMPLATE_PULL_REQUEST,
		target: PATHS.GITHUB_PR_INSTRUCTIONS,
	},
	{
		source: PATHS.DOCS_TEMPLATE_ISSUE,
		target: PATHS.GITHUB_ISSUE_TEMPLATE_BUG,
	},
	{
		source: PATHS.DOCS_TEMPLATE_ISSUE,
		target: PATHS.GITHUB_ISSUE_TEMPLATE_FEATURE,
	},
] as const;

/**
 * GitHub VCS Plugin Configuration
 * Creates .github directory structure and VCS template symlinks
 * Separates VCS provider concerns from IDE integration (Copilot)
 */
export const githubPlugin: PluginConfig = {
	id: "github",
	name: "GitHub VCS Integration",
	description: "GitHub VCS template symlinks (.github/)",
	dependencies: ["docs"],
	policies: [
		// Create .github directory
		{
			policyId: POLICY_IDS.MKDIR,
			source: "",
			target: PATHS.GITHUB_DIR,
			options: { recursive: true },
		},
		// Create .github/ISSUE_TEMPLATE directory (GitHub convention for multiple issue templates)
		{
			policyId: POLICY_IDS.MKDIR,
			source: "",
			target: PATHS.GITHUB_ISSUE_TEMPLATE_DIR,
			options: { recursive: true },
		},
		// Create VCS template symlinks following GitHub conventions
		...VCS_TEMPLATE_SYMLINKS.map(({ source, target }) => ({
			policyId: POLICY_IDS.SYMLINK_RELATIVE,
			source,
			target,
			options: { interactiveMode: false, warnOnExistingNonAiddFiles: false },
		})),
	],
};
