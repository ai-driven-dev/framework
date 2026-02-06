import type {
	AiddFramework,
	ComponentSelection,
	IdeConfiguration,
	ProjectStructure,
} from "./component-selection.js";

export function createComponentSelection(
	ide: IdeConfiguration,
	project?: ProjectStructure,
	framework?: AiddFramework,
): ComponentSelection {
	return {
		ide,
		project: project || { documentation: true },
		framework: framework || { mandatory: true },
	};
}

export function createFullComponentSelection(): ComponentSelection {
	return {
		ide: {
			claudeCode: true,
			copilot: true,
			cursor: true,
			vscode: true,
			windsurf: true,
		},
		project: {
			documentation: true,
		},
		framework: {
			mandatory: true,
		},
	};
}

export function createAutoComponentSelection(): ComponentSelection {
	return {
		ide: {
			claudeCode: true,
			copilot: true,
			cursor: false,
			vscode: true,
			windsurf: false,
		},
		project: {
			documentation: true,
		},
		framework: {
			mandatory: true,
		},
	};
}
