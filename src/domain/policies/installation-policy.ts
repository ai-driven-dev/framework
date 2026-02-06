import type { Stats } from "node:fs";
import type { PolicyId } from "./policy-ids.js";
import type { PolicyOptions } from "./policy-options.js";
import type { RollbackData } from "./rollback-data.js";

export type VerbosityLevel = "normal" | "verbose";

export interface InstallationPolicy {
	/**
	 * Unique identifier for the policy
	 */
	id: PolicyId;

	/**
	 * Human-readable name for the policy
	 */
	name: string;

	/**
	 * Description of what this policy does
	 */
	description: string;

	/**
	 * Execute the policy with given parameters
	 */
	execute(context: PolicyContext): Promise<PolicyResult>;

	/**
	 * Check if the policy can rollback changes
	 */
	canRollback(): boolean;

	/**
	 * Rollback changes made by this policy
	 */
	rollback?(context: PolicyContext, executionData: RollbackData): Promise<void>;
}

export interface PolicyContext {
	/**
	 * Source path for the operation
	 */
	source: string;

	/**
	 * Target path for the operation
	 */
	target: string;

	/**
	 * Installation options
	 */
	options: {
		dryRun: boolean;
		verbose: boolean;
		force: boolean;
	};

	/**
	 * Output verbosity level
	 */
	verbosity: VerbosityLevel;

	/**
	 * Additional policy-specific options
	 */
	policyOptions?: PolicyOptions;

	/**
	 * File system operations interface
	 */
	fs: FileSystemAdapter;

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

export interface PolicyResult {
	/**
	 * Whether the policy execution succeeded
	 */
	success: boolean;

	/**
	 * Warning messages from execution
	 */
	warnings: string[];

	/**
	 * Error messages from execution
	 */
	errors: string[];

	/**
	 * Method used for the operation (e.g., "symlink", "copy", "merge")
	 */
	method?: string;

	/**
	 * Data needed for rollback (if supported)
	 */
	rollbackData?: RollbackData;

	/**
	 * Whether the operation was skipped
	 */
	skipped?: boolean;
}

export interface FileSystemAdapter {
	/**
	 * Check if path exists
	 */
	exists(path: string): boolean;

	/**
	 * Create a symlink
	 */
	createSymlink(source: string, target: string, type?: string): Promise<void>;

	/**
	 * Copy file or directory
	 */
	copy(source: string, target: string, options?: CopyOptions): Promise<void>;

	/**
	 * Read file content
	 */
	readFile(path: string): Promise<string>;

	/**
	 * Write file content
	 */
	writeFile(path: string, content: string): Promise<void>;

	/**
	 * Change file or directory permissions
	 */
	chmod(path: string, mode: number): Promise<void>;

	/**
	 * Create directory
	 */
	mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;

	/**
	 * Remove file or directory
	 */
	remove(path: string): Promise<void>;

	/**
	 * Check if path is a symlink
	 */
	isSymlink(path: string): Promise<boolean>;

	/**
	 * Read directory contents
	 */
	readdir(path: string): Promise<string[]>;

	/**
	 * Read symlink target
	 */
	readlink(path: string): Promise<string>;

	/**
	 * Get file/directory stats (doesn't follow symlinks)
	 */
	lstat(path: string): Promise<Stats>;

	/**
	 * Create timestamped backup of file or directory
	 * @returns backup path if created, null if source doesn't exist
	 */
	createBackup(path: string): Promise<string | null>;
}

export interface CopyOptions {
	/**
	 * Preserve file timestamps
	 */
	preserveTimestamps?: boolean;

	/**
	 * Overwrite existing files
	 */
	overwrite?: boolean;

	/**
	 * Include only these directories (safer than exclude)
	 */
	include?: string[];

	/**
	 * Include only these files (safer than exclude)
	 */
	includeFiles?: string[];

	/**
	 * Exclude patterns for directory copying (legacy - prefer include)
	 */
	exclude?: string[];
}

export interface DisplayAdapter {
	/**
	 * Generic display method for all message types
	 */
	show(
		message: string,
		type: "info" | "success" | "warning" | "error" | "progress",
		verbosity?: VerbosityLevel,
	): void;
}
