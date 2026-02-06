import { promises as fs, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect } from "vitest";
import { itWhenCiOrFlag } from "../../__tests__/utils/slow-test-helpers.js";
import { removeOldTarballs, run } from "../../__tests__/utils/test-utils";

const itPack = itWhenCiOrFlag("RUN_PACK_E2E");

describe("Pack and install CLI (tarball)", () => {
	itPack(
		"packs the package and runs aidd install inside output-tests",
		async () => {
			const cliDir = process.cwd();
			// 1) Clean previous tarballs and pack
			await removeOldTarballs(cliDir);
			const packRes = await run("npm", ["pack"], { cwd: cliDir });
			expect(packRes.code).toBe(0);

			// npm pack prints the tarball filename on stdout (trim to get name)
			const packedName = packRes.stdout
				.split("\n")
				.map((s) => s.trim())
				.filter(Boolean)
				.pop();
			if (!packedName || !/^ai-driven-dev-aidd-.*\.tgz$/.test(packedName)) {
				throw new Error(
					`Failed to determine packed tarball name from output: ${packRes.stdout}`,
				);
			}
			const tarballPath = join(cliDir, packedName);
			expect(existsSync(tarballPath)).toBe(true);

			// 2) Prepare a fresh test project in output-tests
			const outBase = resolve(cliDir, "..", "output-tests");
			const projectDir = join(outBase, `pack-install-${Date.now()}`);
			await fs.mkdir(projectDir, { recursive: true });

			// Initialize and install the tarball locally
			const env = {
				...process.env,
				npm_config_registry: "https://registry.npmjs.org/",
			};
			const initRes = await run("npm", ["init", "-y"], {
				cwd: projectDir,
				env,
			});
			expect(initRes.code).toBe(0);

			const installRes = await run(
				"npm",
				["install", "--no-audit", "--no-fund", tarballPath],
				{ cwd: projectDir, env },
			);
			expect(installRes.code).toBe(0);

			// 3) Run the CLI from the local bin and perform a basic install
			const bin = process.platform === "win32" ? "aidd.cmd" : "aidd";
			const binPath = join(projectDir, "node_modules", ".bin", bin);
			expect(existsSync(binPath)).toBe(true);

			const runRes = await run(
				binPath,
				[
					"install",
					"--auto",
					"--force",
					"--verbose",
					"--directory",
					projectDir,
				],
				{ cwd: projectDir, env },
			);
			if (runRes.code !== 0) {
				throw new Error(
					`aidd install failed.\nSTDOUT:\n${runRes.stdout}\nSTDERR:\n${runRes.stderr}`,
				);
			}

			// 4) Verify minimal expected outputs to confirm installation success
			expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(true);
			expect(existsSync(join(projectDir, "docs"))).toBe(true);
		},
		120_000,
	);
});
