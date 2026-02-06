import type { PluginConfig } from "../install/plugin-config.js";

/**
 * Builtin Plugin Registry
 * Manages static plugin registration for built-in AIDD components
 * Provides plugin lookup and dependency resolution
 */
export class BuiltinPluginRegistry {
	private plugins: Map<string, PluginConfig> = new Map();

	/**
	 * Register a plugin configuration
	 */
	register(plugin: PluginConfig, override = false): void {
		if (!override && this.plugins.has(plugin.id)) {
			throw new Error(`Plugin with id '${plugin.id}' is already registered`);
		}

		this.plugins.set(plugin.id, plugin);
	}

	/**
	 * Get a plugin by ID
	 */
	get(pluginId: string): PluginConfig | undefined {
		return this.plugins.get(pluginId);
	}

	/**
	 * Check if a plugin is registered
	 */
	has(pluginId: string): boolean {
		return this.plugins.has(pluginId);
	}

	/**
	 * Get all registered plugin IDs
	 */
	getRegisteredPluginIds(): string[] {
		return Array.from(this.plugins.keys());
	}

	/**
	 * Get all registered plugins
	 */
	getAllPlugins(): PluginConfig[] {
		return Array.from(this.plugins.values());
	}

	/**
	 * Get plugins by their dependencies
	 */
	getPluginsByDependency(dependencyId: string): PluginConfig[] {
		return Array.from(this.plugins.values()).filter((plugin) =>
			plugin.dependencies?.includes(dependencyId),
		);
	}

	/**
	 * Get required plugins (cannot be skipped)
	 */
	getRequiredPlugins(): PluginConfig[] {
		return Array.from(this.plugins.values()).filter(
			(plugin) => plugin.required === true,
		);
	}

	/**
	 * Resolve plugin dependency order
	 * Returns plugins in the order they should be installed
	 *
	 * When skipFramework is true, aidd-framework is excluded from the installation
	 * order since it already exists, but plugins depending on it are still included.
	 *
	 * @param selectedPluginIds - List of plugins selected for installation
	 * @param options - Installation options including skipFramework flag
	 * @returns Ordered list of plugin IDs for installation
	 */
	resolveDependencyOrder(
		selectedPluginIds: string[],
		options?: { skipFramework?: boolean },
	): string[] {
		const resolvedOrder: string[] = [];
		const processed: Set<string> = new Set();
		const visiting: Set<string> = new Set();

		// Make a copy of selectedPluginIds to avoid modifying the original array
		const workingSelectedIds = [...selectedPluginIds];

		const visit = (pluginId: string) => {
			if (processed.has(pluginId)) {
				return;
			}

			if (visiting.has(pluginId)) {
				throw new Error(
					`Circular dependency detected involving plugin: ${pluginId}`,
				);
			}

			const plugin = this.get(pluginId);
			if (!plugin) {
				throw new Error(`Plugin not found: ${pluginId}`);
			}

			visiting.add(pluginId);

			// Visit dependencies first
			if (plugin.dependencies) {
				for (const depId of plugin.dependencies) {
					// Skip externally satisfied dependencies
					if (this.#isDependencySatisfiedExternally(depId, options)) {
						continue;
					}

					// Only include dependency if it's selected or required
					const depPlugin = this.get(depId);
					if (
						depPlugin &&
						(workingSelectedIds.includes(depId) || depPlugin.required)
					) {
						visit(depId);
					}
				}
			}

			visiting.delete(pluginId);
			processed.add(pluginId);
			resolvedOrder.push(pluginId);
		};

		// Visit required plugins FIRST (before selected plugins)
		// This ensures required plugins like 'docs' are installed before plugins that depend on them
		const requiredPlugins = this.getRequiredPlugins();
		for (const plugin of requiredPlugins) {
			// Skip required plugins that are satisfied externally
			if (this.#isDependencySatisfiedExternally(plugin.id, options)) {
				continue;
			}

			// Visit required plugin (will be added to resolvedOrder)
			visit(plugin.id);
		}

		// Then visit all selected plugins
		for (const pluginId of selectedPluginIds) {
			visit(pluginId);
		}

		return resolvedOrder;
	}

	/**
	 * Validate plugin dependencies
	 *
	 * When skipFramework is true, the aidd-framework dependency is considered
	 * externally satisfied (already exists in the project), so we skip its validation.
	 * This allows plugins that depend on aidd-framework to install correctly when
	 * using an existing AIDD installation.
	 *
	 * @param selectedPluginIds - List of plugins selected for installation
	 * @param options - Installation options including skipFramework flag
	 * @returns Array of validation error messages
	 */
	validateDependencies(
		selectedPluginIds: string[],
		options?: { skipFramework?: boolean },
	): string[] {
		const errors: string[] = [];

		for (const pluginId of selectedPluginIds) {
			const plugin = this.get(pluginId);
			if (!plugin) {
				errors.push(`Plugin not found: ${pluginId}`);
				continue;
			}

			if (plugin.dependencies) {
				for (const depId of plugin.dependencies) {
					// CRITICAL: When --skip-framework is used, aidd-framework already exists
					// externally, so we treat this dependency as satisfied
					if (this.#isDependencySatisfiedExternally(depId, options)) {
						continue;
					}

					const depPlugin = this.get(depId);
					if (!depPlugin) {
						errors.push(
							`Plugin '${pluginId}' depends on unknown plugin '${depId}'`,
						);
					} else if (
						!selectedPluginIds.includes(depId) &&
						!depPlugin.required
					) {
						errors.push(
							`Plugin '${pluginId}' depends on '${depId}' which is not selected`,
						);
					}
				}
			}
		}

		return errors;
	}

	/**
	 * Check if a dependency is satisfied externally (exists outside of this installation)
	 *
	 * This is the SINGLE SOURCE OF TRUTH for determining when a dependency
	 * should be considered already satisfied by existing project structure.
	 *
	 * @private
	 * @param dependencyId - The dependency plugin ID to check
	 * @param options - Installation options
	 * @returns true if the dependency is satisfied externally
	 */
	#isDependencySatisfiedExternally(
		dependencyId: string,
		options?: { skipFramework?: boolean },
	): boolean {
		// When --skip-framework is used, aidd-framework is guaranteed to exist
		// This was validated during installer startup
		return dependencyId === "aidd-framework" && options?.skipFramework === true;
	}

	/**
	 * Get plugin installation statistics
	 */
	getInstallationStats(selectedPluginIds: string[]): {
		total: number;
		required: number;
		optional: number;
		withDependencies: number;
	} {
		const resolvedIds = this.resolveDependencyOrder(selectedPluginIds);
		const requiredCount = resolvedIds.filter((id) => {
			const plugin = this.get(id);
			return plugin?.required === true;
		}).length;

		return {
			total: resolvedIds.length,
			required: requiredCount,
			optional: resolvedIds.length - requiredCount,
			withDependencies: resolvedIds.length - selectedPluginIds.length,
		};
	}

	/**
	 * Clear all registered plugins
	 */
	clear(): void {
		this.plugins.clear();
	}

	/**
	 * Get plugin count
	 */
	count(): number {
		return this.plugins.size;
	}
}
