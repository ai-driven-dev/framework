import { isAbsolute, join } from "node:path";
import type { ComponentSelection } from "../../domain/install/component-selection.js";
import type {
	InstallationContext,
	PluginInstallationResult,
} from "../../domain/install/plugin-config.js";
import type { DisplayAdapter } from "../../domain/policies/installation-policy.js";
import type { BuiltinPluginRegistry } from "../../domain/registry/plugin-registry.js";
import type { PolicyRegistry } from "../../domain/registry/policy-registry.js";
import type { AssetLocator } from "../../infra/assets/asset-locator.js";
import { PATHS } from "../../infra/constants/paths.js";
import type { FileSystemAdapter } from "../../infra/fs/file-system-adapter.js";

/**
 * Install Components Use Case
 * Orchestrates plugin-based installation using policies and registries
 * Replaces the legacy InstallerService with a plugin-driven architecture
 */
export class InstallComponentsUseCase {
	constructor(
		private pluginRegistry: BuiltinPluginRegistry,
		private policyRegistry: PolicyRegistry,
		private assetLocator: AssetLocator,
		private fileSystemAdapter: FileSystemAdapter,
		private display: DisplayAdapter,
	) {}

	/**
	 * Install selected components using plugin architecture
	 */
	async install(
		selectedPluginIds: string[],
		installDir: string,
		options: {
			dryRun: boolean;
			verbose: boolean;
			force: boolean;
			skipFramework: boolean;
		},
		components?: ComponentSelection,
		promptService?: {
			prompt: (
				message: string,
				choices: Array<{ name: string; value: string }>,
			) => Promise<string>;
		},
	): Promise<{
		success: boolean;
		results: PluginInstallationResult[];
		errors: string[];
	}> {
		const results: PluginInstallationResult[] = [];
		const errors: string[] = [];

		try {
			// Validate selected plugins exist
			// Pass options to validation so it knows about skipFramework
			const validationErrors = this.pluginRegistry.validateDependencies(
				selectedPluginIds,
				{ skipFramework: options.skipFramework },
			);
			if (validationErrors.length > 0) {
				errors.push(...validationErrors);
				return { success: false, results, errors };
			}

			// Resolve dependency order
			// Pass options so dependencies can be properly resolved
			const installationOrder = this.pluginRegistry.resolveDependencyOrder(
				selectedPluginIds,
				{ skipFramework: options.skipFramework },
			);

			if (options.verbose) {
				this.display.show(
					`Installation order: ${installationOrder.join(" → ")}`,
					"info",
					"verbose",
				);
			}

			// Create installation context
			const context: InstallationContext = {
				installDir,
				options,
				verbosity: options.verbose ? "verbose" : "normal",
				assetLocator: {
					resolve: (assetPath: string) => this.assetLocator.resolve(assetPath),
				},
				display: this.display,
				components: components ? {} : undefined,
				prompt: promptService?.prompt,
			};

			// Install plugins in dependency order
			for (const pluginId of installationOrder) {
				const result = await this.installPlugin(pluginId, context);
				results.push(result);

				if (!result.success && !result.skipped) {
					this.display.show(
						`Plugin '${pluginId}' failed: ${result.errors.join(", ")}`,
						"error",
						context.verbosity,
					);

					// If this is a required plugin, stop installation
					const plugin = this.pluginRegistry.get(pluginId);
					if (plugin?.required) {
						errors.push(`Required plugin '${pluginId}' failed`);
						break;
					}
				}
			}

			const successfulInstalls = results.filter(
				(r) => r.success && !r.skipped,
			).length;
			const skippedInstalls = results.filter((r) => r.skipped).length;
			const failedInstalls = results.filter(
				(r) => !r.success && !r.skipped,
			).length;

			if (context.verbosity === "verbose") {
				this.display.show(
					`Installation complete: ${successfulInstalls} successful, ${skippedInstalls} skipped, ${failedInstalls} failed`,
					"info",
					"verbose",
				);
			} else {
				// Show operation summary in minimal mode
				this.showOperationSummary(results);
			}

			return {
				success: failedInstalls === 0,
				results,
				errors,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			errors.push(errorMessage);
			this.display.show(errorMessage, "error", "normal");

			return {
				success: false,
				results,
				errors,
			};
		}
	}

	/**
	 * Show operation summary in minimal mode
	 */
	private showOperationSummary(results: PluginInstallationResult[]): void {
		// Count successful plugin installations
		const successfulPlugins = results.filter(
			(r) => r.success && !r.skipped,
		).length;

		if (successfulPlugins > 0) {
			this.display.show(
				`Installed ${successfulPlugins} components successfully`,
				"success",
				"normal",
			);
		}
	}

	/**
	 * Install a single plugin using its configuration
	 */
	private async installPlugin(
		pluginId: string,
		context: InstallationContext,
	): Promise<PluginInstallationResult> {
		const plugin = this.pluginRegistry.get(pluginId);
		if (!plugin) {
			return {
				pluginId,
				success: false,
				warnings: [],
				errors: [`Plugin not found: ${pluginId}`],
			};
		}

		try {
			// Check if installation should proceed
			if (plugin.shouldInstall && !(await plugin.shouldInstall(context))) {
				return {
					pluginId,
					success: true,
					warnings: [],
					errors: [],
					skipped: true,
					skipReason: "Plugin determined installation not needed",
				};
			}

			if (context.verbosity === "verbose") {
				this.display.show(
					`Installing plugin: ${plugin.name}`,
					"progress",
					"verbose",
				);
			}

			const warnings: string[] = [];
			const errors: string[] = [];

			// Execute each policy instruction
			for (const instruction of plugin.policies) {
				const policy = this.policyRegistry.get(instruction.policyId);
				if (!policy) {
					const error = `Policy not found: ${instruction.policyId}`;
					errors.push(error);
					continue;
				}

				// Resolve source path using asset resolver, except for:
				// - symlink-relative: uses project-relative paths
				// - symlink-absolute, copy-with-suffix: point to local AIDD/project files
				// - copy-hard: when source is project-level file (AGENTS.md, docs/*)
				let resolvedSource: string;
				if (instruction.policyId === "symlink-relative") {
					resolvedSource = instruction.source;
				} else if (
					instruction.policyId === "symlink-absolute" ||
					instruction.policyId === "copy-with-suffix"
				) {
					// For symlinks and copy-with-suffix, resolve local project vs framework paths
					if (
						instruction.source.startsWith("docs/") ||
						instruction.source === "AGENTS.md"
					) {
						// Project-level files (created by docs plugin), resolve relative to install dir
						resolvedSource = join(context.installDir, instruction.source);
					} else {
						// AIDD framework files, resolve relative to AIDD_ROOT
						resolvedSource = join(
							context.installDir,
							PATHS.AIDD_ROOT,
							instruction.source,
						);
					}
				} else if (
					instruction.policyId === "copy-hard" &&
					(instruction.source.startsWith("docs/") ||
						instruction.source === "AGENTS.md")
				) {
					// Project-level hard copies (docs/, AGENTS.md) come from install dir
					resolvedSource = join(context.installDir, instruction.source);
				} else {
					// For other policies (hard-copy from assets, etc.), use assets directory
					resolvedSource = context.assetLocator.resolve(instruction.source);
				}

				// Resolve target path - use absolute path as-is, or join with installation directory for relative paths
				const resolvedTarget = isAbsolute(instruction.target)
					? instruction.target
					: join(context.installDir, instruction.target);

				// Create policy context
				const policyContext = {
					source: resolvedSource,
					target: resolvedTarget,
					options: context.options,
					verbosity: context.verbosity,
					policyOptions: {
						...instruction.options,
						installDir: context.installDir, // Pass installDir to policies that need it
					},
					fs: this.fileSystemAdapter,
					display: context.display,
					prompt: context.prompt,
				};

				// Execute policy
				const result = await policy.execute(policyContext);
				warnings.push(...result.warnings);
				errors.push(...result.errors);

				if (!result.success) {
					this.display.show(
						`Policy '${instruction.policyId}' failed for plugin '${pluginId}'`,
						"error",
						context.verbosity,
					);
				}
			}

			// Run custom validation if provided
			if (plugin.validate) {
				const validationResult = await plugin.validate(context);
				warnings.push(...validationResult.warnings);
				errors.push(...validationResult.errors);

				if (!validationResult.success) {
					errors.push(`Plugin validation failed: ${pluginId}`);
				}
			}

			const success = errors.length === 0;
			if (success && context.verbosity === "verbose") {
				this.display.show(
					`Plugin installed: ${plugin.name}`,
					"success",
					"verbose",
				);
			}

			return {
				pluginId,
				success,
				warnings,
				errors,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			this.display.show(errorMessage, "error", "normal");

			return {
				pluginId,
				success: false,
				warnings: [],
				errors: [errorMessage],
			};
		}
	}
}
