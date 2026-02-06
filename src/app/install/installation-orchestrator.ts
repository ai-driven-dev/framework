import type { ComponentSelection } from "../../domain/install/component-selection.js";
import { AssetLocator } from "../../infra/assets/asset-locator.js";
import { FileSystemAdapter } from "../../infra/fs/file-system-adapter.js";
import { InstallComponentsUseCase } from "./install.controller.js";

import type { DisplayAdapter } from "../../domain/policies/installation-policy.js";
import { BuiltinPluginRegistry } from "../../domain/registry/plugin-registry.js";
import { PolicyRegistry } from "../../domain/registry/policy-registry.js";

// Import primitive policies
import { HardCopyPolicy } from "../../domain/policies/primitives/copy-hard.js";
import { CopyIfMissingPolicy } from "../../domain/policies/primitives/copy-if-missing.js";
import { CopyOverwriteWithBackupPolicy } from "../../domain/policies/primitives/copy-overwrite-with-backup.js";
import { CopyWithSuffixPolicy } from "../../domain/policies/primitives/copy-with-suffix.js";
import { CreateFilePolicy } from "../../domain/policies/primitives/create-file.js";
import { MergeJsonPolicy } from "../../domain/policies/primitives/merge-json.js";
import { MergeTextPolicy } from "../../domain/policies/primitives/merge-text.js";
import { MkdirPolicy } from "../../domain/policies/primitives/mkdir.js";
import { OverwriteWithBackupPolicy } from "../../domain/policies/primitives/overwrite-backup.js";
import { RunPackageInstallPolicy } from "../../domain/policies/primitives/run-package-install.js";
import { AbsoluteSymlinkPolicy } from "../../domain/policies/primitives/symlink-absolute.js";
import { RelativeSymlinkPolicy } from "../../domain/policies/primitives/symlink-relative.js";

// Import all plugins
import { aiddFrameworkPlugin } from "../../domain/plugins/aidd-framework-config.js";
import { createClaudeCodePlugin } from "../../domain/plugins/claude-code-config.js";
import { createCopilotPlugin } from "../../domain/plugins/copilot-config.js";
import { createCursorPlugin } from "../../domain/plugins/cursor-config.js";
import { docsPlugin } from "../../domain/plugins/docs-config.js";
import { githubPlugin } from "../../domain/plugins/github-config.js";
import { vscodePlugin } from "../../domain/plugins/vscode-config.js";
import { windsurfPlugin } from "../../domain/plugins/windsurf-config.js";

/**
 * Installation Orchestrator
 * Coordinates plugin execution with dependencies and manages the complete installation workflow
 * Provides the main entry point for the new plugin-based architecture
 */
export class InstallationOrchestrator {
	private pluginRegistry: BuiltinPluginRegistry;
	private policyRegistry: PolicyRegistry;
	private assetLocator: AssetLocator;
	private fileSystemAdapter: FileSystemAdapter;
	private useCase: InstallComponentsUseCase;
	private display: DisplayAdapter;

	constructor(displayAdapter?: DisplayAdapter) {
		// Initialize registries and adapters
		this.pluginRegistry = new BuiltinPluginRegistry();
		this.policyRegistry = new PolicyRegistry();
		this.assetLocator = new AssetLocator();
		this.fileSystemAdapter = new FileSystemAdapter();

		// Use provided display adapter or create default instance
		this.display =
			displayAdapter ||
			new (require("../ui/display.service.js").DisplayService)();

		// Initialize use case
		this.useCase = new InstallComponentsUseCase(
			this.pluginRegistry,
			this.policyRegistry,
			this.assetLocator,
			this.fileSystemAdapter,
			this.display,
		);

		// Register all policies
		this.registerPolicies();

		// Register all plugins
		this.registerPlugins();
	}

	/**
	 * Register all installation policies
	 */
	private registerPolicies(): void {
		const policies = [
			new AbsoluteSymlinkPolicy(),
			new HardCopyPolicy(),
			new CopyWithSuffixPolicy(),
			new MergeTextPolicy(),
			new CopyOverwriteWithBackupPolicy(),
			new OverwriteWithBackupPolicy(),
			new MergeJsonPolicy(),
			new MkdirPolicy(),
			new CopyIfMissingPolicy(),
			new RelativeSymlinkPolicy(),
			new CreateFilePolicy(),
			new RunPackageInstallPolicy(),
		];

		for (const policy of policies) {
			this.policyRegistry.register(policy);
		}
	}

	/**
	 * Register all builtin plugins with default configuration
	 */
	private registerPlugins(): void {
		const plugins = [
			aiddFrameworkPlugin,
			docsPlugin,
			githubPlugin, // GitHub VCS templates (depends on docs, before copilot)
			createClaudeCodePlugin(),
			createCopilotPlugin(),
			createCursorPlugin(),
			windsurfPlugin,
			vscodePlugin,
		];

		for (const plugin of plugins) {
			this.pluginRegistry.register(plugin);
		}
	}

	/**
	 * Install selected components using the plugin architecture
	 */
	async install(params: {
		selectedPluginIds: string[];
		installDir: string;
		options: {
			dryRun: boolean;
			verbose: boolean;
			force: boolean;
			skipFramework: boolean;
		};
		components?: ComponentSelection;
		promptService?: {
			prompt: (
				message: string,
				choices: Array<{ name: string; value: string }>,
			) => Promise<string>;
		};
	}): Promise<{
		success: boolean;
		warnings: string[];
		installedComponents: string[];
		errors?: string[];
	}> {
		const {
			selectedPluginIds,
			installDir,
			options,
			components,
			promptService,
		} = params;
		try {
			// Install using the use case with components context
			const result = await this.useCase.install(
				selectedPluginIds,
				installDir,
				options,
				components,
				promptService,
			);

			// Process installation results
			const warnings: string[] = [];
			const installedComponents: string[] = [];

			for (const pluginResult of result.results) {
				if (pluginResult.success && !pluginResult.skipped) {
					const plugin = this.pluginRegistry.get(pluginResult.pluginId);
					if (plugin) {
						installedComponents.push(plugin.name);
					}
				}
				warnings.push(...pluginResult.warnings);
			}

			return {
				success: result.success,
				warnings,
				installedComponents,
				errors: result.errors.length > 0 ? result.errors : undefined,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			this.display.show(errorMessage, "error");

			return {
				success: false,
				warnings: [],
				installedComponents: [],
				errors: [errorMessage],
			};
		}
	}

	/**
	 * Get available plugins for selection
	 */
	getAvailablePlugins(): Array<{
		id: string;
		name: string;
		description: string;
		required: boolean;
	}> {
		return this.pluginRegistry.getAllPlugins().map((plugin) => ({
			id: plugin.id,
			name: plugin.name,
			description: plugin.description,
			required: plugin.required || false,
		}));
	}

	/**
	 * Validate plugin dependencies
	 */
	validateDependencies(selectedPluginIds: string[]): string[] {
		return this.pluginRegistry.validateDependencies(selectedPluginIds);
	}

	/**
	 * Get installation statistics
	 */
	getInstallationStats(selectedPluginIds: string[]) {
		return this.pluginRegistry.getInstallationStats(selectedPluginIds);
	}
}
