import { join } from "node:path";
import { DOCS_DIRECTORIES, PATHS } from "../../infra/constants/paths.js";
import { getGlobalAiddPath } from "../../infra/utils/aidd-paths.js";
import type { PluginConfig } from "../install/plugin-config.js";
import { POLICY_IDS } from "../policies/policy-ids.js";

/**
 * Documentation Plugin Configuration
 * Creates documentation structure (docs/) - Required for IDE integrations
 * Sets up project organization and flows symlink integration
 */
export const docsPlugin: PluginConfig = {
	id: "docs",
	name: "Documentation Structure",
	description:
		"Documentation structure (docs/) - Required for IDE integrations",
	dependencies: ["aidd-framework"],
	required: true,
	policies: [
		{
			policyId: POLICY_IDS.COPY_HARD,
			source: "assets",
			target: getGlobalAiddPath("assets"),
			options: {},
		},
		...DOCS_DIRECTORIES.map((dir) => ({
			policyId: POLICY_IDS.MKDIR,
			source: "",
			target: join(PATHS.PROJECT_DOCS_DIR, dir),
			options: {},
		})),
		...DOCS_DIRECTORIES.map((dir) => ({
			policyId: POLICY_IDS.CREATE_FILE,
			source: "",
			target: join(PATHS.PROJECT_DOCS_DIR, dir, ".gitkeep"),
			options: {
				content: "",
			},
		})),
		{
			policyId: POLICY_IDS.COPY_HARD,
			source: join("aidd", "ide", "agents"),
			target: join(PATHS.PROJECT_DOCS_DIR, "agents"),
			options: {
				includeFiles: ["*.md"],
			},
		},
		{
			policyId: POLICY_IDS.COPY_IF_MISSING,
			source: join("aidd", "AGENTS.md"),
			target: "AGENTS.md",
			options: {},
		},
		{
			policyId: POLICY_IDS.COPY_IF_MISSING,
			source: join("aidd", "CONTRIBUTING.md"),
			target: "CONTRIBUTING.md",
			options: {},
		},
		{
			policyId: POLICY_IDS.COPY_IF_MISSING,
			source: join(
				"aidd",
				".aidd",
				"templates",
				"aidd",
				"agents_coordination.md",
			),
			target: join(
				PATHS.PROJECT_DOCS_DIR,
				"memory-bank",
				"AGENTS_COORDINATION.md",
			),
			options: {},
		},
		{
			policyId: POLICY_IDS.COPY_IF_MISSING,
			source: join("aidd", ".aidd", "templates", "vcs", "pull_request.md"),
			target: PATHS.DOCS_TEMPLATE_PULL_REQUEST,
			options: {},
		},
		{
			policyId: POLICY_IDS.COPY_IF_MISSING,
			source: join("aidd", ".aidd", "templates", "vcs", "issue.md"),
			target: PATHS.DOCS_TEMPLATE_ISSUE,
			options: {},
		},
		{
			policyId: POLICY_IDS.COPY_IF_MISSING,
			source: join("aidd", ".aidd", "templates", "vcs", "release.md"),
			target: PATHS.DOCS_TEMPLATE_RELEASE,
			options: {},
		},
	],
};
