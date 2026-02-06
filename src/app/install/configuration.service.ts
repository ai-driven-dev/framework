import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ComponentSelection } from "../../domain/install/component-selection.js";
import type {
	AssetValidation,
	ConflictResult,
	ExistingConfig,
	ValidationResult,
} from "../../domain/install/config-contracts.js";
import { ConflictDetector } from "../../domain/install/conflict-detector.js";
import { AssetValidator } from "../../infra/config/asset-validator.js";
import { EnvironmentValidator } from "../../infra/config/environment-validator.js";
import { PATHS } from "../../infra/constants/paths.js";

/**
 * Configuration Service Implementation
 * Handles configuration detection, validation, and conflict resolution
 */
export class ConfigService {
	private readonly environmentValidator = new EnvironmentValidator();
	private readonly assetValidator = new AssetValidator();
	private readonly conflictDetector = new ConflictDetector();
	/**
	 * Detects existing AIDD configuration in the target directory
	 */
	async detectExistingConfig(installDir: string): Promise<ExistingConfig> {
		const claudeCommandsPath = join(installDir, PATHS.CLAUDE_COMMANDS);
		const claudeAgentsPath = join(installDir, PATHS.CLAUDE_AGENTS);
		const claudeSettingsPath = join(installDir, PATHS.CLAUDE_SETTINGS);
		const cursorRulesPath = join(installDir, PATHS.CURSOR_RULES);
		const docsPath = join(installDir, PATHS.PROJECT_DOCS_DIR);
		const gitignorePath = join(installDir, ".gitignore");

		// Check for AIDD entries in gitignore
		const { promises: fs } = await import("node:fs");
		const gitignoreExists =
			existsSync(gitignorePath) &&
			(await fs.readFile(gitignorePath, "utf-8")).includes(
				"# AIDD - AI-Driven Dev",
			);

		const claudeCodeExists =
			existsSync(claudeCommandsPath) ||
			existsSync(claudeAgentsPath) ||
			existsSync(claudeSettingsPath);

		return {
			claudeCode: claudeCodeExists,
			cursor: existsSync(cursorRulesPath),
			privacyProtection: gitignoreExists,
			docsStructure: existsSync(docsPath),
		};
	}

	/**
	 * Validates the installation environment and permissions
	 */
	async validateEnvironment(installDir: string): Promise<ValidationResult> {
		return this.environmentValidator.validateEnvironment(installDir);
	}

	/**
	 * Detects configuration conflicts for selected components
	 */
	detectConflicts(
		existingConfig: ExistingConfig,
		selectedComponents: ComponentSelection,
	): ConflictResult {
		return this.conflictDetector.detectConflicts(
			existingConfig,
			selectedComponents,
		);
	}

	/**
	 * Validates that required assets exist for selected components
	 */
	async validateAssets(
		selectedComponents: ComponentSelection,
	): Promise<AssetValidation> {
		return this.assetValidator.validateAssets(selectedComponents);
	}
}

// Export singleton instance
export const configService = new ConfigService();
