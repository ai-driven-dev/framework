import type { ComponentSelection } from "../../domain/install/component-selection.js";

export interface InstallOptions {
	directory?: string;
	components?: ComponentSelection;
	skipFramework?: boolean;
	dryRun?: boolean;
	verbose?: boolean;
	force?: boolean;
	full?: boolean;
	auto?: boolean;
}
