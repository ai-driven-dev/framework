/**
 * User-facing messages, prompts, and section headers used across the CLI.
 * Domain-level pure data so it can be reused by presentation layers.
 */
export const SECTION_HEADERS = {
	IDE_CONFIG: "🛠️  IDE Configuration",
	PRIVACY_SETTINGS: "🔒 Privacy & Security Settings",
	AIDD_FRAMEWORK: "📦 AIDD Framework (Required)",
	PROJECT_STRUCTURE: "📁 Additional Project Structure",
	INSTALLATION_SUMMARY: "📋 Installation Summary",
} as const;

export const MESSAGES = {
	INSTALLATION_SEPARATOR: "",
	DRY_RUN_NOTICE: "DRY RUN - No changes will be made",
	INSTALLATION_COMPLETE: "\n✅ Installation complete!",
	EXISTING_CONFIG_DETECTED: "\nExisting AIDD configuration detected:",
	INSTALLATION_CANCELLED: "Installation cancelled by user",
	ENVIRONMENT_VALIDATION_FAILED:
		"Environment validation failed. Please resolve the errors above.",
	IDE_CONFIG_MULTISELECT: "Press space to select, Enter to confirm",
	PRIVACY_HELP:
		"Configure privacy protection for your AI development workflow.",
	AIDD_FRAMEWORK_HELP:
		"Installing core AIDD framework - this is mandatory for functionality.",
	AIDD_FRAMEWORK_REQUIRED:
		"⚠️  AIDD Framework is required for the system to function properly.",
	PROJECT_STRUCTURE_HELP:
		"Set up additional documentation and organizational structure.",
	SCAFFOLD_GENERATION_SUCCESS: "Generated scaffold files in docs/",
} as const;

export const PROMPTS = {
	INSTALLATION_DIRECTORY:
		"Enter the full path to your project directory where AIDD should be installed:",
	IDE_SELECTION:
		"Which IDE(s) do you want to configure? (Select with SPACEBAR, confirm with ENTER):",
	PRIVACY_PROTECTION: "Enable privacy protection (.gitignore entries)?",
	PROCEED_QUESTION: "How would you like to proceed?",
	FINAL_CONFIRMATION: "Proceed with installation?",
} as const;

export const CHOICES = {
	OVERWRITE_CONFIG: "Overwrite existing configuration",
	BACKUP_AND_OVERWRITE: "Backup existing and overwrite",
	CANCEL_INSTALLATION: "Cancel installation",
} as const;
