import { promises as fs } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getE2ETestDir } from "../../__tests__/utils/test-utils";
import { isGitSubmodule } from "./platform.js";

describe("platform", () => {
	const testDir = getE2ETestDir();

	describe("isGitSubmodule", () => {
		it("should detect git submodule", async () => {
			const { execSync } = await import("node:child_process");
			const tempParent = join(testDir, "test-submodule-parent");
			const tempSubmoduleSource = join(testDir, "test-submodule-source");
			const submodulePath = join(tempParent, "aidd");

			try {
				// Clean up
				await fs
					.rm(tempParent, { recursive: true, force: true })
					.catch(() => {});
				await fs
					.rm(tempSubmoduleSource, {
						recursive: true,
						force: true,
					})
					.catch(() => {});

				// Create REAL git repo to use as submodule source
				await fs.mkdir(tempSubmoduleSource, { recursive: true });
				execSync("git init", { cwd: tempSubmoduleSource, stdio: "pipe" });
				execSync("git config --local user.name 'Test'", {
					cwd: tempSubmoduleSource,
					stdio: "pipe",
				});
				execSync("git config --local user.email 'test@test.com'", {
					cwd: tempSubmoduleSource,
					stdio: "pipe",
				});
				await fs.writeFile(join(tempSubmoduleSource, "README.md"), "test");
				execSync("git add .", { cwd: tempSubmoduleSource, stdio: "pipe" });
				execSync("git commit -m 'init'", {
					cwd: tempSubmoduleSource,
					stdio: "pipe",
				});

				// Create parent repo
				await fs.mkdir(tempParent, { recursive: true });
				execSync("git init", { cwd: tempParent, stdio: "pipe" });
				execSync("git config --local user.name 'Test'", {
					cwd: tempParent,
					stdio: "pipe",
				});
				execSync("git config --local user.email 'test@test.com'", {
					cwd: tempParent,
					stdio: "pipe",
				});

				// Create REAL submodule manually (git submodule structure)
				// 1. Clone the source repo into submodule path
				await fs.mkdir(submodulePath, { recursive: true });
				execSync(`git clone ${tempSubmoduleSource} .`, {
					cwd: submodulePath,
					stdio: "pipe",
				});

				// 2. Create .git/modules/aidd directory in parent
				const modulesDir = join(tempParent, ".git", "modules", "aidd");
				await fs.mkdir(modulesDir, { recursive: true });

				// 3. Move .git directory to modules (real submodule structure)
				const submoduleGitDir = join(submodulePath, ".git");
				execSync(`cp -r ${submoduleGitDir}/* ${modulesDir}/`, {
					stdio: "pipe",
				});

				// 4. Replace .git directory with file pointing to modules
				await fs.rm(submoduleGitDir, { recursive: true });
				await fs.writeFile(
					submoduleGitDir,
					"gitdir: ../../.git/modules/aidd\n",
				);

				// 5. Create .gitmodules file
				await fs.writeFile(
					join(tempParent, ".gitmodules"),
					`[submodule "aidd"]\n\tpath = aidd\n\turl = ${tempSubmoduleSource}\n`,
				);

				// Test with REAL submodule structure
				const result = await isGitSubmodule(submodulePath);
				expect(result).toBe(true);
			} finally {
				await fs
					.rm(tempParent, { recursive: true, force: true })
					.catch(() => {});
				await fs
					.rm(tempSubmoduleSource, { recursive: true, force: true })
					.catch(() => {});
			}
		});

		it("should return false for regular directory", async () => {
			// Use e2e test directory with regular subdirectory
			const tempDir = join(testDir, "test-regular");
			const regularPath = join(tempDir, "aidd");

			try {
				// Clean up any existing temp directory
				try {
					await fs.rm(tempDir, { recursive: true, force: true });
				} catch {
					// Ignore if directory doesn't exist
				}

				// Create temp directory and regular aidd folder
				await fs.mkdir(tempDir, { recursive: true });
				await fs.mkdir(regularPath, { recursive: true });

				// Test the function
				const result = await isGitSubmodule(regularPath);
				expect(result).toBe(false);
			} finally {
				// Clean up (optional - e2e test dir will be cleaned by global teardown)
				try {
					await fs.rm(tempDir, { recursive: true, force: true });
				} catch {
					// Ignore cleanup errors
				}
			}
		});
	});
});
