import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CopyOverwriteWithBackupPolicy } from "../../../domain/policies/primitives/copy-overwrite-with-backup.js";
import { runCopyPolicy } from "./helpers.js";

describe("CopyOverwriteWithBackupPolicy", () => {
	let baseDir: string;
	let policy: CopyOverwriteWithBackupPolicy;

	beforeEach(async () => {
		baseDir = await mkdtemp(join(tmpdir(), "copy-overwrite-with-backup-"));
		policy = new CopyOverwriteWithBackupPolicy();
	});

	afterEach(async () => {
		await rm(baseDir, { recursive: true, force: true });
	});

	it("copies when target is missing", async () => {
		const { result, target } = await runCopyPolicy({
			policy,
			baseDir,
			sourceContent: "original",
			force: false,
		});

		expect(result.success).toBe(true);
		expect(await readFile(target, "utf-8")).toBe("original");
	});

	it("skips overwrite when target exists and force is false", async () => {
		const { result, target } = await runCopyPolicy({
			policy,
			baseDir,
			sourceContent: "new",
			targetContent: "existing",
			force: false,
		});

		expect(result.success).toBe(true);
		expect(result.warnings.some((w) => w.includes("Use --force"))).toBe(true);
		expect(await readFile(target, "utf-8")).toBe("existing");
	});

	it("overwrites with backup when force is true", async () => {
		const { result, target } = await runCopyPolicy({
			policy,
			baseDir,
			sourceContent: "forced",
			targetContent: "old",
			force: true,
		});

		expect(result.success).toBe(true);
		expect(result.warnings.some((w) => w.includes("was overwritten"))).toBe(
			true,
		);

		const backupFile = (await readdir(baseDir)).find((file) =>
			file.startsWith("target.txt.backup."),
		);

		if (!backupFile) {
			throw new Error("Expected backup file to be created");
		}

		const backupContent = await readFile(join(baseDir, backupFile), "utf-8");
		expect(backupContent).toBe("old");
		expect(await readFile(target, "utf-8")).toBe("forced");
	});
});
