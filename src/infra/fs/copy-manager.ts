import { promises as fs } from "node:fs";
import type { Stats } from "node:fs";
import { dirname, join } from "node:path";
import type { CopyOptions } from "../../domain/policies/installation-policy.js";
import { copyDirectoryRecursive } from "../utils/platform.js";

export class CopyManager {
	constructor(
		private readonly exists: (path: string) => boolean,
		private readonly mkdir: (
			path: string,
			options?: { recursive?: boolean },
		) => Promise<void>,
		private readonly remove: (path: string) => Promise<void>,
		private readonly lstat: (path: string) => Promise<Stats>,
		private readonly readdir: (path: string) => Promise<string[]>,
	) {}

	async copy(
		source: string,
		target: string,
		options: CopyOptions = {},
	): Promise<void> {
		const {
			preserveTimestamps = true,
			overwrite = true,
			exclude = [],
			include = [],
			includeFiles = [],
		} = options;

		const parentDir = dirname(target);
		if (parentDir !== target) {
			await this.mkdir(parentDir, { recursive: true });
		}

		if (overwrite && this.exists(target)) {
			await this.remove(target);
		}

		const sourceStats = await this.lstat(source);

		if (sourceStats.isDirectory()) {
			if (include.length > 0) {
				await this.copyDirectoryWithInclusion(
					source,
					target,
					include,
					includeFiles,
				);
			} else {
				await copyDirectoryRecursive(source, target, exclude);
			}
		} else if (sourceStats.isFile()) {
			await fs.copyFile(source, target);

			if (preserveTimestamps) {
				const stats = await fs.stat(source);
				await fs.utimes(target, stats.atime, stats.mtime);
			}
		}
	}

	private async copyDirectoryWithInclusion(
		source: string,
		target: string,
		includeDirectories: string[],
		includeFiles: string[],
	): Promise<void> {
		await this.mkdir(target, { recursive: true });

		const entries = await this.readdir(source);

		for (const entry of entries) {
			const sourcePath = join(source, entry);
			const targetPath = join(target, entry);

			const stats = await this.lstat(sourcePath);

			if (stats.isSymbolicLink()) {
				continue;
			}

			if (stats.isDirectory()) {
				if (
					includeDirectories.length === 0 ||
					includeDirectories.includes(entry)
				) {
					await this.copyDirectoryWithInclusion(
						sourcePath,
						targetPath,
						[],
						includeFiles,
					);
				}
			} else if (stats.isFile()) {
				if (
					includeFiles.length === 0 ||
					includeFiles.some((pattern) => entry.match(pattern))
				) {
					await fs.copyFile(sourcePath, targetPath);
				}
			}
		}
	}
}
