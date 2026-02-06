import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { InstallationOrchestrator } from "../app/install/installation-orchestrator.js";
import { createDisplayService } from "../app/ui/display.service.js";
import type { ComponentSelection } from "../domain/install/component-selection.js";
import { PluginCatalog } from "../domain/install/plugin-catalog.js";
import {
	cleanupE2ETestDir,
	createE2ETestDir,
} from "./utils/filesystem-ops-new.js";

/**
 * Global setup - runs once before all tests
 * Installs AIDD with ALL components in a single directory
 */
export async function setup() {
	console.log("🚀 E2E Test Suite - Global Setup");

	// Create the test directory
	const testDir = await createE2ETestDir();
	console.log(`📁 Test directory: ${testDir}`);

	// Ensure the test directory is a Git repository for hook installation
	const gitDir = join(testDir, ".git");
	if (!existsSync(gitDir)) {
		const result = spawnSync("git", ["init"], { cwd: testDir });
		if (result.status !== 0) {
			throw new Error(
				`Failed to initialize git repository in ${testDir}: ${result.stderr?.toString()}`,
			);
		}
		console.log("✅ Initialized git repository for test project");
	}

	// Check if already installed (in case of watch mode) - validate critical outputs
	if (existsSync(join(testDir, "aidd")) && isInstallationComplete(testDir)) {
		console.log(
			"✅ AIDD already installed and complete, skipping installation",
		);
		process.env.E2E_TEST_DIR = testDir;
		return;
	}

	console.log("📦 Installing AIDD with all components...");

	// Create orchestrator
	const displayService = createDisplayService("verbose");
	const orchestrator = new InstallationOrchestrator(displayService);

	// Full component selection - everything enabled for comprehensive testing
	const components: ComponentSelection = {
		ide: {
			claudeCode: true,
			copilot: true,
			cursor: true,
			vscode: true,
			windsurf: true,
		},
		project: {
			documentation: true,
		},
		framework: {
			mandatory: true,
		},
	};

	// Convert components to plugin IDs using the domain catalog (same as normal install command)
	const catalog = new PluginCatalog();
	const selectedPluginIds = catalog.getSelectedPluginIds(components, false);

	console.log(`📦 Installing plugins: ${selectedPluginIds.join(", ")}`);

	// Install everything
	const result = await orchestrator.install({
		selectedPluginIds,
		installDir: testDir,
		options: {
			dryRun: false,
			verbose: false,
			force: true,
			skipFramework: false,
		},
		components,
	});

	// Allow installation to succeed even with warnings
	if (
		!result.success &&
		!result.warnings?.some(
			(w) =>
				w.includes("Content already exists") ||
				w.includes("AIDD aliases already exist"),
		)
	) {
		const errorMsg = result.warnings?.length
			? result.warnings.join(", ")
			: "Unknown error";
		console.error("Installation result:", result);
		throw new Error(`Installation failed: ${errorMsg}`);
	}

	console.log("✅ Installation complete");
	console.log(
		`📍 Installed components: ${result.installedComponents.join(", ")}`,
	);

	// Set environment variable for tests to use
	process.env.E2E_TEST_DIR = testDir;
}

/**
 * Global teardown - runs once after all tests
 */
export async function teardown() {
	console.log("🏁 E2E Test Suite - Global Teardown");

	// Cleanup test directory only if explicitly requested
	if (process.env.E2E_CLEANUP === "1" || process.env.CLEANUP_TEST_DIR === "1") {
		await cleanupE2ETestDir();
		console.log("🧹 Cleaned up test directory");
		return;
	}

	// Preserve test directory by default for inspection
	console.log("📁 Test directory preserved for inspection");
	console.log(`📍 Location: ${process.env.E2E_TEST_DIR}`);
	console.log("💡 To cleanup after tests, set E2E_CLEANUP=1");
}

/**
 * Minimal check to ensure previous installation is complete enough for tests
 */
function isInstallationComplete(base: string): boolean {
	try {
		const mustExist = [
			// Framework
			"aidd",
			// VS Code
			".vscode",
			".vscode/settings.json",
			".vscode/extensions.json",
			// Claude Code
			".claude/commands/ide",
			".claude/agents",
			".claude/settings.json",
			".claude/mcp.json",
			// GitHub Copilot
			".github",
			".github/agents",
			".github/prompts",
			".github/instructions",
			".github/copilot-instructions.md",
			// Cursor
			".cursor/rules",
			// Docs
			"AGENTS.md",
			"CLAUDE.md",
		];

		// Additional checks for symlink targets
		const symlinkChecks = [{ link: "CLAUDE.md", expectedTarget: "AGENTS.md" }];

		for (const check of symlinkChecks) {
			try {
				const linkPath = join(base, check.link);
				const target = readlinkSync(linkPath);
				const resolvedTarget = resolve(linkPath, "..", target);
				const expectedResolved = resolve(base, check.expectedTarget);
				if (resolvedTarget !== expectedResolved) return false;
			} catch {
				return false;
			}
		}

		for (const rel of mustExist) {
			const p = join(base, rel);
			if (!existsSync(p)) return false;
			// where we expect symlinks/directories, basic stat check
			if (
				rel.endsWith("/ide") ||
				rel.endsWith("/agents") ||
				rel.endsWith("/rules")
			) {
				try {
					const st = lstatSync(p);
					if (!st.isSymbolicLink() && !st.isDirectory()) return false;
				} catch {
					return false;
				}
			}
		}
		return true;
	} catch {
		return false;
	}
}
