import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CopyIfMissingPolicy } from "../../../domain/policies/primitives/copy-if-missing.js";
import { runCopyPolicy } from "./helpers.js";

describe("CopyIfMissingPolicy", () => {
	let baseDir: string;

	beforeEach(async () => {
		baseDir = await mkdtemp(join(tmpdir(), "copy-if-missing-"));
	});

	afterEach(async () => {
		await rm(baseDir, { recursive: true, force: true });
	});

	it("copies when target is absent", async () => {
		const policy = new CopyIfMissingPolicy();

		const { result, target } = await runCopyPolicy({
			policy,
			baseDir,
			sourceContent: "seed",
			force: false,
		});

		expect(result.success).toBe(true);
		expect(await readFile(target, "utf-8")).toBe("seed");
	});

	it("skips when target already exists", async () => {
		const policy = new CopyIfMissingPolicy();

		const { result, target } = await runCopyPolicy({
			policy,
			baseDir,
			sourceContent: "new",
			targetContent: "existing",
			force: false,
		});

		expect(result.success).toBe(true);
		expect(result.skipped).toBe(true);
		expect(await readFile(target, "utf-8")).toBe("existing");
	});
});
