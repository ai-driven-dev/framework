import inquirer from "inquirer";
import { CHOICES, MESSAGES, PROMPTS } from "../../domain/constants/messages.js";
import type {
	ComponentSelection,
	IdeConfiguration,
} from "../../domain/install/component-selection.js";
import { createComponentSelection } from "../../domain/install/component-selections.js";
import { PROMPT_SECTIONS } from "../../domain/install/prompt-sections.js";
import type { DisplayAdapter } from "../../domain/policies/installation-policy.js";
import type { InstallOptions } from "./install-options.js";

export interface PromptAnswers {
	directory: string;
	components?: ComponentSelection;
}

/**
 * Prompt Service Implementation
 * Handles all user interactions through inquirer.js
 */
export class PromptService {
	constructor(private display: DisplayAdapter) {}
	/**
	 * Prompts for basic installation options (directory and components)
	 */
	async promptBasicOptions(options: InstallOptions): Promise<PromptAnswers> {
		// 1. Prompt for directory if not provided
		const directory = await this.promptDirectory(options.directory);

		// 2. If components not provided, prompt for each section
		if (!options.components) {
			const ide = await this.promptIdeConfiguration();

			// Only prompt for AIDD Framework if not skipping it
			const framework = options.skipFramework
				? { mandatory: false } // Skip framework when --skip-framework is used
				: await this.promptAiddFramework(); // Prompt for framework normally

			// Documentation structure is now mandatory - no prompt needed
			const project = { documentation: true };

			const components = createComponentSelection(ide, project, framework);

			return {
				directory,
				components,
			};
		}

		return {
			directory,
			components: options.components,
		};
	}

	/**
	 * Prompts for installation directory
	 */
	async promptDirectory(currentDirectory?: string): Promise<string> {
		if (currentDirectory) {
			return currentDirectory;
		}

		const answer = await inquirer.prompt([
			{
				type: "input",
				name: "directory",
				message: PROMPTS.INSTALLATION_DIRECTORY,
				default: process.cwd(),
			},
		]);

		return answer.directory;
	}

	/**
	 * Prompts for IDE configuration
	 */
	async promptIdeConfiguration(): Promise<IdeConfiguration> {
		this.display.show(`\n${PROMPT_SECTIONS.ide.header}`, "info", "normal");
		this.display.show(PROMPT_SECTIONS.ide.help, "info", "normal");

		const choices = [
			{
				name: "Claude Code (.claude/commands, .claude/agents, .claude/settings)",
				value: "claudeCode",
				checked: false,
			},
			{
				name: "VS Code (.vscode/settings.json, extensions, user keybindings)",
				value: "vscode",
				checked: false,
			},
			{
				name: "GitHub Copilot (.github/agents, .github/prompts, .github/instructions, VS Code settings)",
				value: "copilot",
				checked: false,
			},
			{
				name: "Cursor (.cursor/rules)",
				value: "cursor",
				checked: false,
			},
			{
				name: "Windsurf (.windsurf/rules, .windsurf/global_rules.md)",
				value: "windsurf",
				checked: false,
			},
		];

		const answer = await inquirer.prompt([
			{
				type: "checkbox",
				name: "ides",
				message: PROMPTS.IDE_SELECTION,
				choices,
				validate: (choices: string[]) => {
					if (choices.length === 0) {
						return "Please select at least one IDE";
					}
					return true;
				},
			},
		]);

		return {
			claudeCode: answer.ides.includes("claudeCode"),
			copilot: answer.ides.includes("copilot"),
			cursor: answer.ides.includes("cursor"),
			vscode: answer.ides.includes("vscode"),
			windsurf: answer.ides.includes("windsurf"),
		};
	}

	/**
	 * Prompts for AIDD Framework installation (mandatory)
	 */
	async promptAiddFramework(): Promise<{ mandatory: boolean }> {
		const section = PROMPT_SECTIONS.framework;

		this.display.show(`\n${section.header}`, "info", "normal");
		this.display.show(section.requiredText, "info", "normal");
		this.display.show(section.help, "info", "normal");

		this.display.show(
			"\nThe following components will be installed:",
			"info",
			"normal",
		);
		for (const detail of section.details) {
			this.display.show(detail, "info", "normal");
		}

		this.display.show(`\n${section.finalNote}`, "info", "normal");

		return {
			mandatory: true, // Always true
		};
	}

	/**
	 * Prompts for final installation confirmation
	 */
	async promptInstallationSummary(
		components: ComponentSelection,
	): Promise<boolean> {
		const summary = PROMPT_SECTIONS.summary;

		this.display.show(`\n${summary.header}`, "info", "normal");
		this.display.show("The following will be installed:\n", "info", "normal");

		// Display AIDD Framework (only if not skipped)
		if (components.framework.mandatory) {
			for (const line of summary.framework) {
				this.display.show(line, "info", "normal");
			}
		}

		// Display IDE Configuration
		if (components.ide.claudeCode || components.ide.cursor) {
			this.display.show("\nIDE Configuration:", "info", "normal");
			if (components.ide.claudeCode)
				this.display.show(summary.ide.claude, "info", "normal");
			if (components.ide.cursor)
				this.display.show(summary.ide.cursor, "info", "normal");
		}

		// Display Additional Project Structure
		if (components.project.documentation) {
			this.display.show("\nAdditional Project Structure:", "info", "normal");
			this.display.show(summary.project, "info", "normal");
		}

		const answer = await inquirer.prompt([
			{
				type: "confirm",
				name: "proceed",
				message: PROMPTS.FINAL_CONFIRMATION,
				default: true,
			},
		]);

		return answer.proceed;
	}

	/**
	 * Prompts for confirmation when configuration conflicts are detected
	 */
	async promptForConflictResolution(_conflictItems: string[]): Promise<void> {
		const overwriteAnswer = await inquirer.prompt([
			{
				type: "list",
				name: "overwrite",
				message: PROMPTS.PROCEED_QUESTION,
				choices: [
					{ name: CHOICES.OVERWRITE_CONFIG, value: "overwrite" },
					{ name: CHOICES.CANCEL_INSTALLATION, value: "cancel" },
				],
			},
		]);

		if (overwriteAnswer.overwrite === "cancel") {
			throw new Error(MESSAGES.INSTALLATION_CANCELLED);
		}
	}

	/**
	 * Generic prompt for list selection
	 */
	async promptList(
		message: string,
		choices: Array<{ name: string; value: string }>,
	): Promise<string> {
		const answer = await inquirer.prompt([
			{
				type: "list",
				name: "choice",
				message,
				choices: choices.map((choice) => ({
					name: choice.name,
					value: choice.value,
				})),
			},
		]);

		return answer.choice;
	}

	/**
	 * Prompts user when existing aidd/ folder is detected
	 */
	async promptSkipFramework(): Promise<boolean> {
		this.display.show("\nWhat would you like to do?", "info", "normal");

		const answer = await inquirer.prompt([
			{
				type: "confirm",
				name: "skipFramework",
				message: "Use --skip-framework to preserve existing aidd/ folder?",
				default: true,
			},
		]);

		return answer.skipFramework;
	}
}

// Note: PromptService requires a DisplayAdapter to be injected
// Create instances with: new PromptService(displayAdapter)
