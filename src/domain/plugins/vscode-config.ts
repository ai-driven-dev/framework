import { PATHS } from "../../infra/constants/paths.js";
import type { PluginConfig } from "../install/plugin-config.js";
import { POLICY_IDS } from "../policies/policy-ids.js";

/**
 * VS Code Plugin Configuration
 * - Project-level: merges .vscode/settings.json and .vscode/extensions.json
 * - User-level: merges keybindings into VS Code's user keybindings.json
 */
export const vscodePlugin: PluginConfig = {
	id: "vscode",
	name: "VS Code",
	description:
		"VS Code integration (.vscode/settings.json, extensions, keybindings)",
	dependencies: [],
	policies: [
		// Ensure .vscode directory exists in the project
		{
			policyId: POLICY_IDS.MKDIR,
			source: "", // not used
			target: PATHS.VSCODE_DIR,
			options: { recursive: true },
		},
		// Merge settings.json (user settings take precedence)
		{
			policyId: POLICY_IDS.MERGE_JSON,
			source: "aidd/config/.vscode/settings.json",
			target: PATHS.VSCODE_SETTINGS,
			options: {
				userFirst: true,
				arrayUnion: true,
			},
		},
		// Merge extensions.json (union of recommendations)
		{
			policyId: POLICY_IDS.MERGE_JSON,
			source: "aidd/config/.vscode/extensions.json",
			target: PATHS.VSCODE_EXTENSIONS,
			options: {
				userFirst: true,
				arrayUnion: true,
			},
		},
		// Merge keybindings into project-level .vscode/keybindings.json
		{
			policyId: POLICY_IDS.MERGE_JSON,
			source: "aidd/config/.vscode/keybindings.json",
			target: PATHS.VSCODE_KEYBINDINGS,
			options: {
				userFirst: true,
				arrayUnion: true,
			},
		},
	],
};
