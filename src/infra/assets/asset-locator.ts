import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PATHS } from "../constants/paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Asset Locator
 * Provides unified path resolution for assets in dist/assets/
 * Handles differences between source and built distribution modes
 */
export class AssetLocator {
	private readonly assetsDir: string;

	constructor() {
		// Check if we're running from source (tests/dev) or built distribution
		const isRunningFromSource =
			__dirname.includes("src") && !__dirname.includes("node_modules");

		if (isRunningFromSource) {
			// Running from src/ during development
			// src/infra/assets → ../../../dist/assets
			this.assetsDir = join(__dirname, "../../../dist", PATHS.ASSETS_DIR);
		} else {
			// Running from dist/ (packaged via npm or local build)
			// dist/ → ./assets
			this.assetsDir = join(__dirname, PATHS.ASSETS_DIR);
		}
	}

	/**
	 * Resolve asset path relative to assets directory
	 */
	resolve(assetPath: string): string {
		return join(this.assetsDir, assetPath);
	}

	/**
	 * Get the base assets directory path
	 */
	getAssetsDir(): string {
		return this.assetsDir;
	}

	/**
	 * Resolve multiple asset paths
	 */
	resolveMultiple(assetPaths: string[]): string[] {
		return assetPaths.map((path) => this.resolve(path));
	}

	/**
	 * Check if an asset exists
	 */
	exists(assetPath: string): boolean {
		const { existsSync } = require("node:fs");
		return existsSync(this.resolve(assetPath));
	}

	/**
	 * Get Cursor specific asset paths
	 */
	getCursorPaths() {
		return {
			rules: this.resolve("docs"),
		};
	}

	/**
	 * Get privacy asset paths
	 */
	getPrivacyPaths() {
		return {
			gitignore: this.resolve("aidd/config/gitignore.template"),
		};
	}
}
