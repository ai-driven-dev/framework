import type { ComponentSelection } from "./component-selection.js";

/**
 * PluginCatalog
 * Centralizes the mapping from high-level ComponentSelection
 * to concrete plugin IDs understood by the orchestrator.
 */
export class PluginCatalog {
	getSelectedPluginIds(
		components: ComponentSelection,
		skipFramework = false,
	): string[] {
		const pluginIds: string[] = [];

		// Framework is mandatory (unless explicitly skipped)
		if (!skipFramework) {
			pluginIds.push("aidd-framework");
		}

		// IDE components
		if (components.ide.claudeCode) {
			pluginIds.push("claude-code");
		}
		if (components.ide.copilot) {
			pluginIds.push("copilot");
			this.ensurePluginIncluded(pluginIds, "vscode");
			// GitHub VCS plugin is required for Copilot workflows (VCS templates, issue/PR symlinks)
			this.ensurePluginIncluded(pluginIds, "github");
		}
		if (components.ide.cursor) {
			pluginIds.push("cursor");
		}
		if (components.ide.windsurf) {
			pluginIds.push("windsurf");
		}
		if (components.ide.vscode) {
			pluginIds.push("vscode");
		}

		// Project components - no explicit mapping needed
		// (docs plugin is always installed via required: true)

		return pluginIds;
	}

	private ensurePluginIncluded(pluginIds: string[], pluginId: string): void {
		if (!pluginIds.includes(pluginId)) {
			pluginIds.push(pluginId);
		}
	}
}
