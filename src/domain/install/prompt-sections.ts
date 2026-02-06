import { MESSAGES, SECTION_HEADERS } from "../constants/messages.js";

export const PROMPT_SECTIONS = {
	ide: {
		header: SECTION_HEADERS.IDE_CONFIG,
		help: MESSAGES.IDE_CONFIG_MULTISELECT,
	},
	privacy: {
		header: SECTION_HEADERS.PRIVACY_SETTINGS,
		help: MESSAGES.PRIVACY_HELP,
	},
	framework: {
		header: SECTION_HEADERS.AIDD_FRAMEWORK,
		requiredText: MESSAGES.AIDD_FRAMEWORK_REQUIRED,
		help: MESSAGES.AIDD_FRAMEWORK_HELP,
		details: [
			"  ✓ ide/agents/ - AI agents for development workflow",
			"  ✓ ide/prompts/ - Complete command structure (onboard → maintenance)",
			"  ✓ .aidd/templates/ - All template files",
			"  ✓ config/ - Configuration files",
			"  ✓ docs/ - Complete documentation structure",
			"  ✓ package.json - Framework dependencies",
		],
		finalNote: "This installation is mandatory for AIDD to function.",
	},
	project: {
		header: SECTION_HEADERS.PROJECT_STRUCTURE,
		help: MESSAGES.PROJECT_STRUCTURE_HELP,
	},
	summary: {
		header: SECTION_HEADERS.INSTALLATION_SUMMARY,
		framework: [
			"AIDD Framework (Required):",
			"  ✓ Core agents and workflow",
			"  ✓ Complete command structure (prompts)",
			"  ✓ Templates",
			"  ✓ Configuration files",
			"  ✓ Documentation",
			"  ✓ Package dependencies",
		],
		ide: {
			claude: "  ✓ Claude Code Integration",
			cursor: "  ✓ Cursor Rules",
		},
		privacy: {
			privacyProtection: "  ✓ Privacy protection (.gitignore)",
		},
		project:
			"  ✓ Documentation structure (docs/) - Required for IDE integrations",
	},
};
