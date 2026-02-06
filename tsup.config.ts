import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/cli.ts", "src/index.ts"],
	format: ["esm"],
	target: "node18",
	dts: true,
	sourcemap: true,
	clean: true,
	onSuccess: async () => {
		const assetsDir = "dist/assets";

		// Create assets directory
		mkdirSync(assetsDir, { recursive: true });

		// Source paths relative to CLI package directory
		const sources = [
			{ src: "../framework", dest: "aidd" },
			{ src: "./assets", dest: "assets" },
			{ src: "../package.json", dest: "package.json" },
		];

		for (const { src, dest } of sources) {
			const sourcePath = join(process.cwd(), src);
			const destPath = join(assetsDir, dest);

			if (existsSync(sourcePath)) {
				try {
					cpSync(sourcePath, destPath, { recursive: true });
					console.log(`✅ Bundled: ${src} → ${dest}`);
				} catch (error) {
					console.warn(`⚠️  Warning: Could not bundle ${src}:`, error);
				}
			} else {
				console.warn(`⚠️  Warning: Source not found: ${src}`);
			}
		}

		console.log("🎉 AIDD assets bundled successfully");

		// Add shebang to CLI file after build
		const { readFile, writeFile } = await import("node:fs/promises");
		const cliPath = "dist/cli.js";
		const cliContent = await readFile(cliPath, "utf-8");

		if (!cliContent.startsWith("#!/usr/bin/env node")) {
			await writeFile(cliPath, `#!/usr/bin/env node\n${cliContent}`);
			console.log("✅ Added shebang to CLI executable");
		}
	},
});
