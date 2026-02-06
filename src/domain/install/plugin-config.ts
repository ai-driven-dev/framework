/**
 * Plugin Configuration Interface
 * Defines the structure for plugin-based installation components
 */

import type {
	DisplayAdapter,
	VerbosityLevel,
} from "../policies/installation-policy.js";
import type { PolicyId } from "../policies/policy-ids.js";
import type { PolicyOptions } from "../policies/policy-options.js";

export interface PluginConfig {
	/**
	 * Unique identifier for the plugin
	 */
	id: string;

	/**
	 * Human-readable name for the plugin
	 */
	name: string;

	/**
	 * Description of what this plugin installs
	 */
	description: string;

	/**
	 * Plugin dependencies that must be installed before this plugin
	 */
	dependencies?: string[];

	/**
	 * Whether this plugin is mandatory and cannot be skipped
	 */
	required?: boolean;

	/**
	 * Installation policies to execute for this plugin
	 */
	policies: PolicyInstruction[];

	/**
	 * Custom validation function to check if installation is needed
	 */
	shouldInstall?: (context: InstallationContext) => Promise<boolean>;

	/**
	 * Custom post-installation validation function
	 */
	validate?: (context: InstallationContext) => Promise<ValidationResult>;
}

export interface PolicyInstruction {
	/**
	 * Policy identifier to use for this instruction
	 */
	policyId: PolicyId;

	/**
	 * Source path for the installation operation
	 */
	source: string;

	/**
	 * Target path for the installation operation
	 */
	target: string;

	/**
	 * Additional options passed to the policy
	 */
	options?: PolicyOptions;
}

export interface InstallationContext {
	/**
	 * Base installation directory
	 */
	installDir: string;

	/**
	 * Installation options
	 */
	options: {
		dryRun: boolean;
		verbose: boolean;
		force: boolean;
		skipFramework: boolean;
	};

	/**
	 * Output verbosity level
	 */
	verbosity: VerbosityLevel;

	/**
	 * Asset locator for finding bundled assets
	 */
	assetLocator: {
		resolve: (assetPath: string) => string;
	};

	/**
	 * Selected components for contextual configuration
	 */
	components?: {
		mcpServers?: string[];
		[key: string]: unknown;
	};

	/**
	 * Display service for output
	 */
	display: DisplayAdapter;

	/**
	 * Prompt service for user interaction (optional)
	 */
	prompt?: (
		message: string,
		choices: Array<{ name: string; value: string }>,
	) => Promise<string>;
}

export interface ValidationResult {
	/**
	 * Whether the validation passed
	 */
	success: boolean;

	/**
	 * Warning messages from validation
	 */
	warnings: string[];

	/**
	 * Error messages from validation
	 */
	errors: string[];
}

export interface PluginInstallationResult {
	/**
	 * Plugin identifier
	 */
	pluginId: string;

	/**
	 * Whether the installation succeeded
	 */
	success: boolean;

	/**
	 * Warning messages from installation
	 */
	warnings: string[];

	/**
	 * Error messages from installation
	 */
	errors: string[];

	/**
	 * Whether the plugin was skipped
	 */
	skipped?: boolean;

	/**
	 * Reason for skipping (if applicable)
	 */
	skipReason?: string;
}
