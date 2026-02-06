import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
	DisplayAdapter,
	InstallationPolicy,
	PolicyContext,
	PolicyResult,
} from "../installation-policy.js";

/**
 * Run Package Install Policy
 * Executes package manager install command (npm/pnpm) in the specified directory.
 * Auto-detects package manager based on lockfile presence.
 */
export class RunPackageInstallPolicy implements InstallationPolicy {
	readonly id = "run-package-install";
	readonly name = "Run Package Install Policy";
	readonly description =
		"Runs package manager install (npm/pnpm) based on lockfile detection";

	async execute(context: PolicyContext): Promise<PolicyResult> {
		const { target, options, display, policyOptions = {} } = context;
		const warnings: string[] = [];
		const { workingDirectory = target } = policyOptions as {
			workingDirectory?: string;
		};

		try {
			const workDir =
				workingDirectory === target ? target : join(target, workingDirectory);

			const packageJsonPath = join(workDir, "package.json");

			if (!existsSync(packageJsonPath)) {
				const warning = `package.json not found in ${workDir}, skipping package install`;
				warnings.push(warning);
				display.show(warning, "warning", context.verbosity);
				return {
					success: true,
					warnings,
					errors: [],
				};
			}

			const packageManager = this.detectPackageManager(workDir);

			if (options.dryRun) {
				display.show(
					`Would run '${packageManager} install' in directory: ${workDir}`,
					"info",
					context.verbosity,
				);
				return {
					success: true,
					warnings,
					errors: [],
				};
			}

			display.show(
				`Running ${packageManager} install in directory: ${workDir}`,
				"progress",
				context.verbosity,
			);

			const installResult = await this.runPackageInstall(
				workDir,
				packageManager,
				context.verbosity === "verbose",
				display,
			);

			if (installResult.success) {
				display.show(
					`Dependencies installed successfully in ${workDir}`,
					"success",
					context.verbosity,
				);
				return {
					success: true,
					warnings,
					errors: [],
				};
			}

			const error = `${packageManager} install failed: ${installResult.error}`;
			display.show(error, "error", context.verbosity);
			return {
				success: false,
				warnings,
				errors: [error],
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			display.show(errorMessage, "error", context.verbosity);
			return {
				success: false,
				warnings,
				errors: [errorMessage],
			};
		}
	}

	/**
	 * Detects the package manager to use based on lockfile presence
	 * @param workingDirectory - Directory to check for lockfiles
	 * @returns Package manager command ('npm' or 'pnpm')
	 */
	private detectPackageManager(workingDirectory: string): "npm" | "pnpm" {
		if (existsSync(join(workingDirectory, "pnpm-lock.yaml"))) {
			return "pnpm";
		}
		if (existsSync(join(workingDirectory, "package-lock.json"))) {
			return "npm";
		}

		// Default to pnpm if no lockfile found
		return "pnpm";
	}

	private async runPackageInstall(
		workingDirectory: string,
		packageManager: "npm" | "pnpm",
		verbose: boolean,
		display: DisplayAdapter,
	): Promise<{ success: boolean; error?: string }> {
		return new Promise((resolve) => {
			const installProcess = spawn(packageManager, ["install"], {
				cwd: workingDirectory,
				stdio: verbose ? "inherit" : "pipe",
				shell: true,
			});

			let errorOutput = "";

			if (!verbose) {
				installProcess.stderr?.on("data", (data) => {
					errorOutput += data.toString();
				});

				installProcess.stdout?.on("data", (data) => {
					if (verbose) {
						display.show(data.toString().trim(), "info", "verbose");
					}
				});
			}

			installProcess.on("close", (code) => {
				if (code === 0) {
					resolve({ success: true });
				} else {
					const error =
						errorOutput || `${packageManager} install exited with code ${code}`;
					resolve({ success: false, error });
				}
			});

			installProcess.on("error", (error) => {
				resolve({
					success: false,
					error: `Failed to start ${packageManager} install: ${error.message}`,
				});
			});
		});
	}

	canRollback(): boolean {
		return false;
	}
}
