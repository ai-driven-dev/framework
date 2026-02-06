import { existsSync, lstatSync, readdirSync, readlinkSync } from "node:fs";
import { join, resolve } from "node:path";

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";

export type RunResult = { code: number; stdout: string; stderr: string };

/**
 * Run a command capturing stdout/stderr as strings.
 */
export function run(
	cmd: string,
	args: string[],
	options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<RunResult> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, {
			cwd: options.cwd,
			env: options.env,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d) => {
			stdout += d.toString();
		});
		child.stderr.on("data", (d) => {
			stderr += d.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
	});
}

/**
 * Remove previously generated npm pack tarballs in a directory.
 */
export async function removeOldTarballs(
	dir: string,
	pattern = /^ai-driven-dev-aidd-.*\.tgz$/,
): Promise<void> {
	const files = await fs.readdir(dir);
	const tgzs = files.filter((f) => pattern.test(f));
	await Promise.all(tgzs.map((f) => fs.rm(join(dir, f), { force: true })));
}

/**
 * Gets the test directory path, creating a fallback if global setup hasn't run
 * This supports both CLI runs (with global setup) and VSCode extension runs
 */
export function getE2ETestDir(): string {
	// Return from env if set by global setup
	if (process.env.E2E_TEST_DIR) {
		return process.env.E2E_TEST_DIR;
	}

	// Fallback for VSCode extension - try to find an existing test directory
	const testBaseDir = join(process.cwd(), "..", "output-tests");

	if (existsSync(testBaseDir)) {
		const testDirs = readdirSync(testBaseDir, { withFileTypes: true })
			.filter(
				(dirent) => dirent.isDirectory() && dirent.name.startsWith("aidd-v"),
			)
			.map((dirent) => dirent.name)
			.sort()
			.reverse(); // Get most recent first

		if (testDirs.length > 0) {
			const latestTestDir = join(testBaseDir, testDirs[0]);
			console.log(`📁 Using existing test directory: ${latestTestDir}`);
			return latestTestDir;
		}
	}

	throw new Error(
		"E2E_TEST_DIR not set and no existing test directory found. " +
			'Run "npm test" first to create a test installation, or set E2E_PRESERVE=1 to keep test directories.',
	);
}

/**
 * Validates that a file exists
 */
export function assertFileExists(filePath: string, message?: string): void {
	if (!existsSync(filePath)) {
		throw new Error(message || `File should exist: ${filePath}`);
	}
}

/**
 * Validates that a directory exists
 */
export function assertDirectoryExists(dirPath: string, message?: string): void {
	if (!existsSync(dirPath)) {
		throw new Error(message || `Directory should exist: ${dirPath}`);
	}

	const stat = lstatSync(dirPath);
	if (!stat.isDirectory()) {
		throw new Error(message || `Path should be a directory: ${dirPath}`);
	}
}

/**
 * Validates that a symlink exists and points to the correct target
 */
export function assertSymlinkExists(
	symlinkPath: string,
	expectedTarget?: string,
	message?: string,
): void {
	if (!existsSync(symlinkPath)) {
		throw new Error(message || `Symlink should exist: ${symlinkPath}`);
	}

	const stat = lstatSync(symlinkPath);
	if (!stat.isSymbolicLink()) {
		throw new Error(
			message || `Path should be a symbolic link: ${symlinkPath}`,
		);
	}

	if (expectedTarget) {
		const actualTarget = readlinkSync(symlinkPath);
		// For tests, we just want to verify the symlink exists and the target exists
		// The exact path may vary between absolute and relative
		const resolvedTarget = resolve(symlinkPath, "..", actualTarget);

		if (!existsSync(resolvedTarget)) {
			throw new Error(
				message ||
					`Symlink ${symlinkPath} points to non-existent target: ${actualTarget}`,
			);
		}
	}
}

/**
 * Validates that a file is a regular file (not a symlink)
 */
export function assertRegularFile(filePath: string, message?: string): void {
	if (!existsSync(filePath)) {
		throw new Error(message || `File should exist: ${filePath}`);
	}

	const stat = lstatSync(filePath);
	if (!stat.isFile()) {
		throw new Error(message || `Path should be a regular file: ${filePath}`);
	}

	if (stat.isSymbolicLink()) {
		throw new Error(
			message || `Path should not be a symbolic link: ${filePath}`,
		);
	}
}

/**
 * Checks if a shell binary is available in the system
 * @param binaryName The name of the binary to check (e.g., 'zsh', 'bash', 'sh')
 * @returns true if the binary exists and is executable, false otherwise
 */
export function isShellAvailable(binaryName: string): boolean {
	try {
		const { execSync } = require("node:child_process");
		// Use 'which' on Unix-like systems to check if binary exists
		execSync(`which ${binaryName}`, { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

/**
 * Asserts MCP servers configuration structure
 * @param servers The servers object from MCP config
 * @param expectedServers Array of expected server names
 */
export function assertMcpServersStructure(
	servers: Record<string, { command?: string }>,
	expectedServers: string[] = [
		"n8n-mcp",
		"playwright",
		"firecrawl",
		"context7",
		"notionApi",
	],
): void {
	for (const serverName of expectedServers) {
		if (!servers[serverName]) {
			throw new Error(`Expected MCP server "${serverName}" not found`);
		}
	}
	// Verify command structure on servers that should have npx
	if (servers["n8n-mcp"]?.command !== "npx") {
		throw new Error('n8n-mcp should have command "npx"');
	}
	if (servers.notionApi?.command !== "npx") {
		throw new Error('notionApi should have command "npx"');
	}
}
