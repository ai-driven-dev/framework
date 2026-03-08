export { installCommand } from "./app/commands/install.js";
export type { InstallOptions } from "./app/install/install-options.js";
export type { CommandResult } from "./domain/worktree/command-result.js";
export type {
	ComponentSelection,
	IdeConfiguration,
	ProjectStructure,
} from "./domain/install/component-selection.js";
export type { VerbosityLevel } from "./domain/policies/installation-policy.js";
export type { AssetPaths } from "./infra/config/asset-paths.js";
