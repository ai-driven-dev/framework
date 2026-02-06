import { existsSync } from "node:fs";
import {
	constants,
	access,
	copyFile,
	lstat,
	mkdir,
	readFile,
	readdir,
} from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Copy directory recursively as fallback for symlinks
 */
export async function copyDirectoryRecursive(
	source: string,
	target: string,
	excludeDirectories: string[] = [],
	isRootLevel = true,
): Promise<void> {
	await mkdir(target, { recursive: true });

	const entries = await readdir(source, { withFileTypes: true });

	for (const entry of entries) {
		const sourcePath = join(source, entry.name);
		const targetPath = join(target, entry.name);

		// Use lstat to properly detect symlinks
		const stats = await lstat(sourcePath);

		// Skip symlinks entirely (they're usually IDE-specific files we want to exclude)
		if (stats.isSymbolicLink()) {
			continue;
		}

		// Skip excluded directories, but only at the root level
		// This allows .claude directories in subdirectories like supports/.claude
		if (
			stats.isDirectory() &&
			isRootLevel &&
			excludeDirectories.includes(entry.name)
		) {
			continue;
		}

		// Also exclude top-level .claude directory specifically (IDE-specific)
		if (stats.isDirectory() && isRootLevel && entry.name === ".claude") {
			continue;
		}

		if (stats.isDirectory()) {
			await copyDirectoryRecursive(
				sourcePath,
				targetPath,
				excludeDirectories,
				false,
			);
		} else if (stats.isFile()) {
			await copyFile(sourcePath, targetPath);
		}
		// Skip other types (sockets, pipes, etc.)
	}
}

/**
 * Check if directory is writable
 */
export async function canWriteToDirectory(dirPath: string): Promise<boolean> {
	try {
		await access(dirPath, constants.W_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if a directory is a git submodule
 * @param dirPath - Path to the directory to check
 * @returns true if the directory is a git submodule, false otherwise
 */
export async function isGitSubmodule(dirPath: string): Promise<boolean> {
	try {
		// Check if there's a .git file (characteristic of git submodules)
		const gitFilePath = join(dirPath, ".git");
		if (existsSync(gitFilePath)) {
			const gitFileContent = await readFile(gitFilePath, "utf-8");
			// In submodules, .git file contains "gitdir: <path>" pointing to the actual git directory
			if (gitFileContent.startsWith("gitdir:")) {
				return true;
			}
		}

		// Alternative check: look for the directory in parent .gitmodules file
		const parentDir = dirname(dirPath);
		const gitmodulesPath = join(parentDir, ".gitmodules");
		if (existsSync(gitmodulesPath)) {
			const gitmodulesContent = await readFile(gitmodulesPath, "utf-8");
			const dirName = dirPath.split("/").pop() || "";
			// Check if this directory is listed as a submodule in .gitmodules
			if (gitmodulesContent.includes(`[submodule "${dirName}"]`)) {
				return true;
			}
		}

		return false;
	} catch {
		// If we can't read the files, assume it's not a submodule
		return false;
	}
}
