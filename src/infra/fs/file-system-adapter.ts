import { promises as fs, existsSync } from "node:fs";
import type { Stats } from "node:fs";
import { dirname } from "node:path";
import type {
	CopyOptions,
	FileSystemAdapter as IFileSystemAdapter,
} from "../../domain/policies/installation-policy.js";
import { CopyManager } from "./copy-manager.js";
import { SymlinkManager } from "./symlink-manager.js";

/**
 * File System Adapter
 * Provides a simplified interface for file system operations
 * Used by installation policies for consistent file operations
 */
export class FileSystemAdapter implements IFileSystemAdapter {
	private readonly symlinkManager: SymlinkManager;
	private readonly copyManager: CopyManager;

	constructor() {
		this.symlinkManager = new SymlinkManager(
			(path) => this.exists(path),
			(path, options) => this.mkdir(path, options),
			(path) => this.remove(path),
		);

		this.copyManager = new CopyManager(
			(path) => this.exists(path),
			(path, options) => this.mkdir(path, options),
			(path) => this.remove(path),
			(path) => this.lstat(path),
			(path) => this.readdir(path),
		);
	}

	/**
	 * Check if path exists
	 */
	exists(path: string): boolean {
		return existsSync(path);
	}

	/**
	 * Create a symlink
	 */
	async createSymlink(
		source: string,
		target: string,
		type?: string,
	): Promise<void> {
		await this.symlinkManager.createSymlink(source, target, type);
	}

	/**
	 * Copy file or directory
	 */
	async copy(
		source: string,
		target: string,
		options: CopyOptions = {},
	): Promise<void> {
		await this.copyManager.copy(source, target, options);
	}

	/**
	 * Read file content
	 */
	async readFile(path: string): Promise<string> {
		return fs.readFile(path, "utf-8");
	}

	/**
	 * Write file content
	 */
	async writeFile(path: string, content: string): Promise<void> {
		// Ensure parent directory exists
		const parentDir = dirname(path);
		if (parentDir !== path) {
			await this.mkdir(parentDir, { recursive: true });
		}

		await fs.writeFile(path, content, "utf-8");
	}

	/**
	 * Change file or directory permissions
	 */
	async chmod(path: string, mode: number): Promise<void> {
		await fs.chmod(path, mode);
	}

	/**
	 * Create directory
	 */
	async mkdir(
		path: string,
		options: { recursive?: boolean } = {},
	): Promise<void> {
		await fs.mkdir(path, options);
	}

	/**
	 * Remove file or directory
	 */
	async remove(path: string): Promise<void> {
		if (this.exists(path)) {
			await fs.rm(path, { recursive: true, force: true });
		}
	}

	/**
	 * Check if path is a symlink
	 */
	async isSymlink(path: string): Promise<boolean> {
		try {
			const stats = await fs.lstat(path);
			return stats.isSymbolicLink();
		} catch {
			return false;
		}
	}

	/**
	 * Get file/directory stats
	 */
	async stat(path: string): Promise<Stats> {
		return fs.stat(path);
	}

	/**
	 * Get symlink stats (doesn't follow the link)
	 */
	async lstat(path: string): Promise<Stats> {
		return fs.lstat(path);
	}

	/**
	 * Read directory contents
	 */
	async readdir(path: string): Promise<string[]> {
		return fs.readdir(path);
	}

	/**
	 * Read symlink target
	 */
	async readlink(path: string): Promise<string> {
		return fs.readlink(path);
	}

	/**
	 * Create timestamped backup of file or directory
	 */
	async createBackup(filePath: string): Promise<string | null> {
		if (!this.exists(filePath)) {
			return null;
		}

		const timestamp = Date.now();
		const backupPath = `${filePath}.backup.${timestamp}`;

		const stats = await this.lstat(filePath);
		if (stats.isDirectory()) {
			await this.copy(filePath, backupPath);
		} else {
			const content = await this.readFile(filePath);
			await fs.writeFile(backupPath, content, "utf-8");
		}

		return backupPath;
	}
}
