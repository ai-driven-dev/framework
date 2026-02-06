import { join } from "node:path";
import { PATHS } from "../../infra/constants/paths.js";
import type { PluginConfig } from "../install/plugin-config.js";
import { POLICY_IDS } from "../policies/policy-ids.js";

/**
 * GitHub Copilot Plugin Configuration Factory
 * - GitHub-specific structure (.github/agents, prompts, instructions)
 * - VS Code settings for Copilot
 */
export function createCopilotPlugin(): PluginConfig {
	return {
		id: "copilot",
		name: "GitHub Copilot",
		description:
			"GitHub Copilot integration (VS Code settings, agents, prompts)",
		dependencies: ["aidd-framework", "vscode", "github"],
		policies: [
			// Create .github directories for Copilot-specific content
			{
				policyId: POLICY_IDS.MKDIR,
				source: "",
				target: PATHS.GITHUB_AGENTS_DIR,
				options: { recursive: true },
			},
			{
				policyId: POLICY_IDS.MKDIR,
				source: "",
				target: PATHS.GITHUB_PROMPTS_DIR,
				options: { recursive: true },
			},
			{
				policyId: POLICY_IDS.MKDIR,
				source: "",
				target: PATHS.GITHUB_INSTRUCTIONS_DIR,
				options: { recursive: true },
			},
			// Copy agents from docs/agents/*.md to .github/agents/*.agent.md
			{
				policyId: POLICY_IDS.COPY_WITH_SUFFIX,
				source: join(PATHS.PROJECT_DOCS_DIR, "agents"),
				target: PATHS.GITHUB_AGENTS_DIR,
				options: {
					suffix: ".agent",
					glob: "*.md",
				},
			},
			// Copy IDE prompts from aidd/ide/prompts to .github/prompts/*.prompt.md
			{
				policyId: POLICY_IDS.COPY_WITH_SUFFIX,
				source: join("ide", "prompts"),
				target: PATHS.GITHUB_PROMPTS_DIR,
				options: {
					suffix: ".prompt",
					glob: "**/*.md",
				},
			},
			// Copy rules from docs/rules to .github/instructions/**/*.instructions.md
			{
				policyId: POLICY_IDS.COPY_WITH_SUFFIX,
				source: join(PATHS.PROJECT_DOCS_DIR, "rules"),
				target: PATHS.GITHUB_INSTRUCTIONS_DIR,
				options: {
					suffix: ".instructions",
					glob: "**/*.md",
				},
			},
			{
				policyId: POLICY_IDS.SYMLINK_RELATIVE,
				source: PATHS.AGENTS_MD,
				target: PATHS.GITHUB_COPILOT_INSTRUCTIONS,
				options: {},
			},
		],
	};
}
