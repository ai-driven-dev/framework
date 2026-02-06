import type { ComponentSelection } from "./component-selection.js";
import type { ConflictResult, ExistingConfig } from "./config-contracts.js";

export class ConflictDetector {
	detectConflicts(
		existingConfig: ExistingConfig,
		selectedComponents: ComponentSelection,
	): ConflictResult {
		const hasConflicts = this.hasConfigurationConflict(
			existingConfig,
			selectedComponents,
		);
		const items = hasConflicts
			? this.getConflictItems(existingConfig, selectedComponents)
			: [];

		return {
			hasConflicts,
			items,
		};
	}

	private hasConfigurationConflict(
		existingConfig: ExistingConfig,
		selectedComponents: ComponentSelection,
	): boolean {
		return (
			(selectedComponents.ide.claudeCode && existingConfig.claudeCode) ||
			(selectedComponents.ide.cursor && existingConfig.cursor) ||
			(selectedComponents.project.documentation && existingConfig.docsStructure)
		);
	}

	private getConflictItems(
		existingConfig: ExistingConfig,
		selectedComponents: ComponentSelection,
	): string[] {
		const conflictItems: string[] = [];

		if (selectedComponents.ide.claudeCode && existingConfig.claudeCode) {
			conflictItems.push("Claude Code integration (.claude/)");
		}
		if (selectedComponents.ide.cursor && existingConfig.cursor) {
			conflictItems.push("Cursor integration (.cursor/rules)");
		}
		if (
			selectedComponents.project.documentation &&
			existingConfig.docsStructure
		) {
			conflictItems.push("Documentation structure (docs/)");
		}
		return conflictItems;
	}
}
