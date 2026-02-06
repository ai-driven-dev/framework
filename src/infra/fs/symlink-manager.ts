import { promises as fs } from "node:fs";
import { dirname } from "node:path";

type SymlinkKind = "dir" | "file" | "junction";

export class SymlinkManager {
	constructor(
		private readonly exists: (path: string) => boolean,
		private readonly mkdir: (
			path: string,
			options?: { recursive?: boolean },
		) => Promise<void>,
		private readonly remove: (path: string) => Promise<void>,
	) {}

	async createSymlink(
		source: string,
		target: string,
		type?: string,
	): Promise<void> {
		const parentDir = dirname(target);
		if (parentDir !== target) {
			await this.mkdir(parentDir, { recursive: true });
		}

		try {
			const stats = await fs.lstat(target);
			if (stats.isSymbolicLink()) {
				const linkTarget = await fs.readlink(target);
				if (linkTarget === source) {
					return;
				}
			}
			await this.remove(target);
		} catch {
			// Target doesn't exist or can't be accessed - that's fine, we'll create it
		}

		let symlinkType = type;
		if (!symlinkType) {
			if (this.exists(source)) {
				const sourceStats = await fs.lstat(source);
				symlinkType = sourceStats.isDirectory() ? "dir" : "file";
			} else {
				const targetBasename = (await import("node:path")).basename(target);
				symlinkType = targetBasename.includes(".") ? "file" : "dir";
			}
		}

		try {
			await fs.symlink(source, target, symlinkType as SymlinkKind);
		} catch (error: unknown) {
			const nodeError = error as NodeJS.ErrnoException;
			if (nodeError.code === "EEXIST") {
				try {
					const stats = await fs.lstat(target);
					if (stats.isSymbolicLink()) {
						const linkTarget = await fs.readlink(target);
						if (linkTarget === source) {
							return;
						}
					}
				} catch {
					// If we can't check the existing link, re-throw original error
				}
			}
			throw error;
		}
	}
}
