import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ComponentSelection } from "../../domain/install/component-selection.js";
import type { AssetValidation } from "../../domain/install/config-contracts.js";
import { PATHS } from "../constants/paths.js";
import type { AssetPaths } from "./asset-paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AssetValidator {
	getAssetPaths(): AssetPaths {
		const isRunningFromSource = __dirname.includes("src/infra");
		const assetsDir = isRunningFromSource
			? join(__dirname, "../../../dist", PATHS.ASSETS_DIR)
			: join(__dirname, PATHS.ASSETS_DIR);

		// Templates are bundled under aidd/.aidd/templates in the assets directory
		const templatesDir = join(assetsDir, "aidd/.aidd/templates");

		return {
			prompts: join(assetsDir, "aidd/ide/prompts"),
			templates: templatesDir,
			claudeSettings: join(assetsDir, "aidd/config/.claude/settings.json"),
			aiddPrompts: join(assetsDir, "aidd/ide/prompts"),
			aiddTemplates: templatesDir,
			aiddSubAgents: join(assetsDir, "assets/sub-agents"),
			aiddPackageJson: join(assetsDir, "package.json"),
		};
	}

	async validateAssets(
		selectedComponents: ComponentSelection,
	): Promise<AssetValidation> {
		const assets = this.getAssetPaths();
		const missingAssets: string[] = [];

		const mandatoryAssets = [
			assets.aiddPrompts,
			assets.aiddTemplates,
			assets.aiddSubAgents,
			assets.aiddPackageJson,
		];

		for (const path of mandatoryAssets) {
			if (!existsSync(path)) {
				missingAssets.push(path);
			}
		}

		if (selectedComponents.ide.claudeCode) {
			if (!existsSync(assets.prompts)) {
				missingAssets.push(assets.prompts);
			}
			if (!existsSync(assets.claudeSettings)) {
				missingAssets.push(assets.claudeSettings);
			}
		}

		return {
			isValid: missingAssets.length === 0,
			missingAssets,
		};
	}
}
