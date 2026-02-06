export interface IdeConfiguration {
	claudeCode: boolean;
	copilot: boolean;
	cursor: boolean;
	vscode: boolean;
	windsurf: boolean;
}

export interface ProjectStructure {
	documentation: boolean;
}

export interface AiddFramework {
	mandatory: boolean;
}

export interface ComponentSelection {
	ide: IdeConfiguration;
	project: ProjectStructure;
	framework: AiddFramework;
}
