import { existsSync } from "node:fs";
import {
	lstat,
	mkdir,
	readFile,
	readlink,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
	DisplayAdapter,
	FileSystemAdapter as IFileSystemAdapter,
	PolicyContext,
} from "../../../../domain/policies/installation-policy.js";
import { RelativeSymlinkPolicy } from "../../../../domain/policies/primitives/symlink-relative.js";
import { FileSystemAdapter } from "../../../../infra/fs/file-system-adapter.js";
import { noopDisplay } from "../helpers.js";

describe("RelativeSymlinkPolicy", () => {
	let baseDir: string;
	let policy: RelativeSymlinkPolicy;

	beforeEach(async () => {
		baseDir = join(tmpdir(), `symlink-relative-${Date.now()}-${Math.random()}`);
		await mkdir(baseDir, { recursive: true });
		policy = new RelativeSymlinkPolicy();
	});

	afterEach(async () => {
		await rm(baseDir, { recursive: true, force: true });
	});

	function createContext(
		source: string,
		target: string,
		options: {
			dryRun?: boolean;
		} = {},
	): PolicyContext {
		return {
			source,
			target,
			options: {
				dryRun: options.dryRun ?? false,
				verbose: false,
				force: false,
			},
			verbosity: "normal",
			policyOptions: {
				installDir: baseDir,
			},
			fs: new FileSystemAdapter(),
			display: noopDisplay,
		};
	}

	describe("creates link from source to target", () => {
		async function setupSourceAndExecute(
			targetPath: string,
			addContent = false,
		) {
			const sourceDir = join(baseDir, "source");
			await mkdir(sourceDir);
			if (addContent) {
				await writeFile(join(sourceDir, "test.txt"), "content");
			}
			const context = createContext("source", targetPath);
			return { sourceDir, result: await policy.execute(context) };
		}

		it("creates link at target location", async () => {
			const targetPath = join(baseDir, "target-link");
			const { result } = await setupSourceAndExecute(targetPath, true);

			expect(result.success).toBe(true);
			expect(existsSync(targetPath)).toBe(true);
			const stats = await lstat(targetPath);
			expect(stats.isSymbolicLink()).toBe(true);
		});

		it("creates missing parent folders automatically", async () => {
			const targetPath = join(baseDir, "nested", "deep", "target-link");
			const { result } = await setupSourceAndExecute(targetPath);

			expect(result.success).toBe(true);
			expect(existsSync(dirname(targetPath))).toBe(true);
			expect(existsSync(targetPath)).toBe(true);
		});

		it("link resolves back to source", async () => {
			const targetPath = join(baseDir, "nested", "target-link");
			const { sourceDir } = await setupSourceAndExecute(targetPath);

			const linkTarget = await readlink(targetPath);
			const expectedRelative = relative(dirname(targetPath), sourceDir);
			expect(linkTarget).toBe(expectedRelative);
		});

		it("handles deeply nested paths", async () => {
			const targetPath = join(baseDir, "a", "b", "c", "d", "target-link");
			const { result } = await setupSourceAndExecute(targetPath);

			expect(result.success).toBe(true);
			expect(existsSync(targetPath)).toBe(true);
		});
	});

	describe("in preview mode", () => {
		it("does not create any file", async () => {
			const sourceDir = join(baseDir, "source");
			await mkdir(sourceDir);

			const targetPath = join(baseDir, "target-link");
			const context = createContext("source", targetPath, { dryRun: true });

			await policy.execute(context);

			expect(existsSync(targetPath)).toBe(false);
		});

		it("reports success without changes", async () => {
			const sourceDir = join(baseDir, "source");
			await mkdir(sourceDir);

			const targetPath = join(baseDir, "target-link");
			const context = createContext("source", targetPath, { dryRun: true });

			const result = await policy.execute(context);

			expect(result.success).toBe(true);
			expect(result.method).toBe("symlink-relative");
		});
	});

	describe("rejects invalid input", () => {
		it("fails if source does not exist", async () => {
			const targetPath = join(baseDir, "target-link");
			const context = createContext("nonexistent-source", targetPath);

			const result = await policy.execute(context);

			expect(result.success).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain("Source path does not exist");
		});
	});

	describe("when link already exists at target", () => {
		it("skips if link is already correct", async () => {
			const sourceDir = join(baseDir, "source");
			await mkdir(sourceDir);

			const targetPath = join(baseDir, "target-link");
			const expectedRelative = relative(baseDir, sourceDir);
			await symlink(expectedRelative, targetPath, "dir");

			let displayedMessage = "";
			const trackingDisplay: DisplayAdapter = {
				show(message: string) {
					displayedMessage = message;
				},
			};

			const context = createContext("source", targetPath);
			context.display = trackingDisplay;

			const result = await policy.execute(context);

			expect(result.success).toBe(true);
			expect(result.skipped).toBe(true);
			expect(displayedMessage).toContain("Symlink already correct");
		});

		it("replaces link pointing to wrong location", async () => {
			const sourceDir = join(baseDir, "source");
			const oldSourceDir = join(baseDir, "old-source");
			await mkdir(sourceDir);
			await mkdir(oldSourceDir);

			const targetPath = join(baseDir, "target-link");
			await symlink(oldSourceDir, targetPath, "dir");

			let displayedMessage = "";
			const trackingDisplay: DisplayAdapter = {
				show(message: string) {
					if (message.includes("Replaced incorrect")) {
						displayedMessage = message;
					}
				},
			};

			const context = createContext("source", targetPath);
			context.display = trackingDisplay;

			const result = await policy.execute(context);

			expect(result.success).toBe(true);
			expect(result.skipped).toBeFalsy();
			const linkTarget = await readlink(targetPath);
			expect(linkTarget).toContain("source");
			expect(displayedMessage).toContain("Replaced incorrect symlink");
		});
	});

	describe("when file or folder exists at target", () => {
		it("backs up file then replaces with link", async () => {
			const sourceDir = join(baseDir, "source");
			await mkdir(sourceDir);
			await writeFile(join(sourceDir, "test.txt"), "source-content");

			const targetPath = join(baseDir, "CLAUDE.md");
			await writeFile(targetPath, "existing-content");

			const context = createContext("source", targetPath);

			const result = await policy.execute(context);

			expect(result.success).toBe(true);
			expect(result.skipped).toBeFalsy();
			expect(existsSync(targetPath)).toBe(true);

			const stats = await lstat(targetPath);
			expect(stats.isSymbolicLink()).toBe(true);

			const { readdir } = await import("node:fs/promises");
			const files = await readdir(baseDir);
			const backupFiles = files.filter((f) =>
				f.startsWith("CLAUDE.md.backup."),
			);
			expect(backupFiles.length).toBeGreaterThan(0);

			const backupContent = await readFile(
				join(baseDir, backupFiles[0]),
				"utf-8",
			);
			expect(backupContent).toBe("existing-content");
		});

		it("backs up folder then replaces with link", async () => {
			const sourceDir = join(baseDir, "source");
			await mkdir(sourceDir);
			await writeFile(join(sourceDir, "test.txt"), "source-content");

			const targetPath = join(baseDir, "existing-dir");
			await mkdir(targetPath);
			await writeFile(join(targetPath, "file.txt"), "dir-content");

			const context = createContext("source", targetPath);

			const result = await policy.execute(context);

			expect(result.success).toBe(true);
			expect(result.skipped).toBeFalsy();

			const stats = await lstat(targetPath);
			expect(stats.isSymbolicLink()).toBe(true);

			const { readdir } = await import("node:fs/promises");
			const files = await readdir(baseDir);
			const backupDirs = files.filter((f) =>
				f.startsWith("existing-dir.backup."),
			);
			expect(backupDirs.length).toBeGreaterThan(0);

			const backupContent = await readFile(
				join(baseDir, backupDirs[0], "file.txt"),
				"utf-8",
			);
			expect(backupContent).toBe("dir-content");
		});
	});

	describe("when undoing changes", () => {
		it("removes the created link", async () => {
			const sourceDir = join(baseDir, "source");
			await mkdir(sourceDir);

			const targetPath = join(baseDir, "target-link");
			await symlink(sourceDir, targetPath, "dir");

			const context = createContext("source", targetPath);

			await policy.rollback(context, { target: targetPath });

			expect(existsSync(targetPath)).toBe(false);
		});

		it("does nothing if target does not exist", async () => {
			const targetPath = join(baseDir, "nonexistent-link");
			const context = createContext("source", targetPath);

			await expect(
				policy.rollback(context, { target: targetPath }),
			).resolves.not.toThrow();
		});

		it("preserves regular files", async () => {
			const targetPath = join(baseDir, "regular-file.txt");
			await writeFile(targetPath, "content");

			const context = createContext("source", targetPath);

			await policy.rollback(context, { target: targetPath });

			expect(existsSync(targetPath)).toBe(true);
			const content = await readFile(targetPath, "utf-8");
			expect(content).toBe("content");
		});

		it("warns user on error", async () => {
			const targetPath = join(baseDir, "target-link");

			let warningMessage = "";
			const trackingDisplay: DisplayAdapter = {
				show(message: string, level?: string) {
					if (level === "warning") {
						warningMessage = message;
					}
				},
			};

			const realFs = new FileSystemAdapter();
			const failingFs: IFileSystemAdapter = {
				exists: () => true,
				isSymlink: async () => true,
				remove: async () => {
					throw new Error("Permission denied");
				},
				copy: realFs.copy.bind(realFs),
				readFile: realFs.readFile.bind(realFs),
				writeFile: realFs.writeFile.bind(realFs),
				mkdir: realFs.mkdir.bind(realFs),
				lstat: realFs.lstat.bind(realFs),
				chmod: realFs.chmod.bind(realFs),
				readlink: realFs.readlink.bind(realFs),
				readdir: realFs.readdir.bind(realFs),
				createSymlink: realFs.createSymlink.bind(realFs),
				createBackup: realFs.createBackup.bind(realFs),
			};

			const context = createContext("source", targetPath);
			context.fs = failingFs;
			context.display = trackingDisplay;

			await expect(
				policy.rollback(context, { target: targetPath }),
			).resolves.not.toThrow();

			expect(warningMessage).toContain("Failed to rollback");
			expect(warningMessage).toContain("Permission denied");
		});
	});
});
