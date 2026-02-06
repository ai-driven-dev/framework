import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { isGitSubmodule } from "../../infra/utils/platform.js";
import { APP_BANNER, APP_NAME, APP_VERSION } from "../constants/app-info.js";
import { configService } from "../install/configuration.service.js";
import { createInstaller } from "../install/create-installer.js";
import { createDisplayService } from "../ui/display.service.js";

import { MESSAGES } from "../../domain/constants/messages.js";
import {
	createAutoComponentSelection,
	createFullComponentSelection,
} from "../../domain/install/component-selections.js";
import { PluginCatalog } from "../../domain/install/plugin-catalog.js";
import type { VerbosityLevel } from "../../domain/policies/installation-policy.js";
import type { CommandResult } from "../../domain/worktree/command-result.js";
import { ERRORS } from "../../infra/constants/errors.js";
import { PATHS } from "../../infra/constants/paths.js";
import type { InstallOptions } from "../install/install-options.js";
import { PromptService } from "../install/prompt.service.js";

/**
 * Main command function to install AIDD framework in a project
 * This is pure orchestration - all business logic is delegated to services
 * @param options - Installation options from CLI or programmatic calls
 * @returns Result object indicating success/failure and any warnings
 */
export async function installCommand(
	options: InstallOptions,
): Promise<CommandResult> {
	const allWarnings: string[] = [];
	const verbosity: VerbosityLevel = options.verbose ? "verbose" : "normal";

	// Create display service instance with proper verbosity context
	const displayService = createDisplayService(verbosity);

	// Create service instances with injected display service
	const promptService = new PromptService(displayService);

	try {
		// 1. Display installation header
		displayService.show(APP_BANNER);
		displayService.show(`🚀 ${APP_NAME}`);
		displayService.show(`⚡ v${APP_VERSION}`);
		displayService.show("");

		// 1.1. Display skip-framework status if enabled
		if (options.skipFramework) {
			displayService.show(
				"Skipping AIDD framework installation (--skip-framework)",
				"warning",
			);
		}

		// 2. Gather complete options through prompts if needed
		const initialInstallDir = resolve(options.directory || process.cwd());
		const config = await gatherCompleteOptions(
			options,
			initialInstallDir,
			promptService,
		);
		const installDir = resolve(config.directory);

		// 2.1. Check for existing aidd/ folder and warn user if it's a git submodule
		const aiddFolderPath = resolve(installDir, PATHS.AIDD_ROOT);
		if (existsSync(aiddFolderPath) && !config.skipFramework) {
			const isSubmodule = await isGitSubmodule(aiddFolderPath);

			if (isSubmodule) {
				displayService.show(
					`⚠️  Git submodule detected at: ${aiddFolderPath}`,
					"warning",
				);
				displayService.show(
					"This appears to be a git submodule. Consider using --skip-framework if you want to keep the existing submodule.",
					"warning",
				);

				// Prompt user for action
				const shouldSkipFramework = await promptService.promptSkipFramework();
				if (shouldSkipFramework) {
					config.skipFramework = true;
					displayService.show(
						"Framework installation will be skipped (--skip-framework enabled)",
						"info",
					);
				}
			} else {
				displayService.show(
					`ℹ️  Existing 'aidd/' folder detected at: ${aiddFolderPath}`,
					"info",
				);
				displayService.show(
					"This appears to be a regular installation. No action needed.",
					"info",
				);
			}
		}

		// 3. Show final confirmation before proceeding (skip for --full and --auto)
		if (!config.full && !config.auto) {
			const shouldProceed = await promptService.promptInstallationSummary(
				config.components,
			);
			if (!shouldProceed) {
				throw new Error(MESSAGES.INSTALLATION_CANCELLED);
			}
		}

		// 4. Display configuration
		displayService.show(`Installation Directory: ${installDir}`, "info");
		displayService.show(`Dry Run: ${config.dryRun ? "Yes" : "No"}`, "info");

		// 4. Validate environment
		const validation = await configService.validateEnvironment(installDir);
		if (!validation.isValid) {
			for (const error of validation.errors) {
				displayService.show(error, "error");
			}
			throw new Error(MESSAGES.ENVIRONMENT_VALIDATION_FAILED);
		}

		// 5. Validate assets exist for selected components
		// Note: Asset validation will be handled by the orchestrator for each plugin
		// For now, we maintain basic validation using new format
		const assetValidation = await configService.validateAssets(
			config.components,
		);
		if (!assetValidation.isValid) {
			for (const asset of assetValidation.missingAssets) {
				throw new Error(ERRORS.REQUIRED_ASSET_NOT_FOUND(asset));
			}
		}

		// 7. Skip conflict detection - proceed with installation directly

		// 8. Perform installation using new plugin architecture
		const orchestrator = createInstaller(displayService);

		// Convert components to plugin IDs using the domain catalog
		const catalog = new PluginCatalog();
		const selectedPluginIds = catalog.getSelectedPluginIds(
			config.components,
			config.skipFramework,
		);

		// Debug: Log what we're about to install
		displayService.show(
			`Selected plugins: ${selectedPluginIds.join(", ")}`,
			"info",
		);

		// Inform user about automatic documentation structure creation
		displayService.show("📁 Creating documentation structure (docs/)", "info");

		const result = await orchestrator.install({
			selectedPluginIds,
			installDir,
			options: {
				dryRun: config.dryRun,
				verbose: config.verbose,
				force: config.force,
				skipFramework: config.skipFramework,
			},
			components: config.components,
			promptService: {
				prompt: async (
					message: string,
					choices: Array<{ name: string; value: string }>,
				) => {
					const inquirer = (await import("inquirer")).default;
					const answer = await inquirer.prompt([
						{
							type: "list",
							name: "choice",
							message,
							choices: choices.map((choice) => ({
								name: choice.name,
								value: choice.value,
							})),
						},
					]);
					return answer.choice;
				},
			},
		});
		allWarnings.push(...result.warnings);

		// 8. Handle gitignore update if user wants privacy protection
		// Note: Privacy protection is now handled as part of the components selection
		// The gitignore update is performed when privacyProtection component is selected

		// 9. Display completion
		if (allWarnings.length > 0) {
			displayService.show("Installation completed with warnings", "warning");
			// Display each warning so users know what went wrong
			for (const warning of allWarnings) {
				displayService.show(`  ${warning}`, "warning");
			}
		} else {
			displayService.show("AIDD installed successfully", "success");
		}

		return {
			success: true,
			message: "AIDD installed successfully",
			warnings: allWarnings.length > 0 ? allWarnings : undefined,
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";

		// Display error with platform-specific troubleshooting
		displayService.show(errorMessage, "error");

		return {
			success: false,
			message: `Installation failed: ${errorMessage}`,
			warnings: allWarnings.length > 0 ? allWarnings : undefined,
		};
	}
}

/**
 * Gathers complete installation options through prompts
 * Ensures all required options have values
 */
async function gatherCompleteOptions(
	options: InstallOptions,
	installDir: string,
	promptService: PromptService,
): Promise<Required<InstallOptions>> {
	// Handle --full option: skip all prompts and use full component selection
	if (options.full) {
		const resolvedDir = options.directory || installDir;
		const fullComponents = createFullComponentSelection();

		return {
			directory: resolvedDir,
			components: fullComponents,
			skipFramework: options.skipFramework || false,
			dryRun: options.dryRun || false,
			verbose: options.verbose || false,
			force: options.force || false,
			full: true,
			auto: false,
		};
	}

	// Handle --auto option: skip all prompts and use auto component selection
	if (options.auto) {
		const resolvedDir = options.directory || installDir;
		const autoComponents = createAutoComponentSelection();

		return {
			directory: resolvedDir,
			components: autoComponents,
			skipFramework: options.skipFramework || false,
			dryRun: options.dryRun || false,
			verbose: options.verbose || false,
			force: options.force || false,
			full: false,
			auto: true,
		};
	}

	// Get basic options (directory and components) if not provided
	const answers = await promptService.promptBasicOptions(options);

	// Resolve directory and components
	const resolvedDir = options.directory || answers.directory || installDir;
	const selectedComponents = options.components || answers.components;

	// Ensure we have valid values
	if (!resolvedDir || !selectedComponents) {
		throw new Error("Missing required installation options");
	}

	return {
		directory: resolvedDir,
		components: selectedComponents,
		skipFramework: options.skipFramework || false,
		dryRun: options.dryRun || false,
		verbose: options.verbose || false,
		force: options.force || false,
		full: false,
		auto: false,
	};
}
