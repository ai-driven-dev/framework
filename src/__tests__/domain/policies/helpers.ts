import { existsSync } from "node:fs";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
	DisplayAdapter,
	FileSystemAdapter,
	InstallationPolicy,
} from "../../../domain/policies/installation-policy.js";

export const noopDisplay: DisplayAdapter = {
	show() {
		// no-op for tests
	},
};

/**
 * Minimal mock adapter for unit tests (no real fs operations)
 */
export function createMockFsAdapter(): FileSystemAdapter {
	const readFileUtf = async (path: string) => readFile(path, "utf-8");
	return {
		exists: existsSync,
		copy: async (src: string, dest: string) => {
			const content = await readFileUtf(src);
			await writeFile(dest, content);
		},
		readFile: readFileUtf,
		writeFile,
		mkdir: async () => {},
		remove: async () => {},
		lstat,
		chmod: async () => {},
		isSymlink: async () => false,
		readlink: async () => "",
		readdir: async () => [],
		createSymlink: async () => {},
		createBackup: async (filePath: string) => {
			if (!existsSync(filePath)) {
				return null;
			}
			const timestamp = Date.now();
			const backupPath = `${filePath}.backup.${timestamp}`;
			const content = await readFileUtf(filePath);
			await writeFile(backupPath, content);
			return backupPath;
		},
	};
}

export function createPolicyContext(
	source: string,
	target: string,
	flags: { force: boolean },
) {
	return {
		source,
		target,
		options: { dryRun: false, verbose: false, force: flags.force },
		verbosity: "normal" as const,
		policyOptions: {},
		fs: createMockFsAdapter(),
		display: noopDisplay,
	};
}

export async function runCopyPolicy(params: {
	policy: InstallationPolicy;
	baseDir: string;
	sourceContent: string;
	targetContent?: string;
	force: boolean;
}) {
	const { policy, baseDir, sourceContent, targetContent, force } = params;
	const source = join(baseDir, "source.txt");
	const target = join(baseDir, "target.txt");

	await writeFile(source, sourceContent);
	if (typeof targetContent === "string") {
		await writeFile(target, targetContent);
	}

	const result = await policy.execute(
		createPolicyContext(source, target, { force }),
	);

	return { result, source, target };
}
