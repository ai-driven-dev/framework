#!/usr/bin/env node

import { Command } from "commander";
import { installCommand } from "./app/commands/install.js";
import { worktreeCommand } from "./app/commands/worktree.js";

const program = new Command()
	.name("aidd")
	.description("AI-Driven Development CLI - Install AIDD framework in projects")
	.version("1.9.7");

program
	.command("install")
	.description("Install AIDD framework in target project")
	.option(
		"-d, --directory <path>",
		"Installation directory (default: current directory)",
	)
	.option("--skip-framework", "Skip AIDD framework installation (use existing)")
	.option("--dry-run", "Preview changes without applying them")
	.option("-v, --verbose", "Enable verbose output for detailed logging")
	.option(
		"--force",
		"Overwrite existing configuration without asking for confirmation",
	)
	.option(
		"--full",
		"Install all components without interactive prompts (for testing)",
	)
	.option("--auto", "Automatic installation with optimized selection")
	.action(async (options) => {
		const result = await installCommand(options);
		if (!result.success) {
			process.exit(1);
		}
	});

program
	.command("worktree")
	.description(
		"Create temporary git worktree and run command (optional name, required command)",
	)
	.argument(
		"<name-or-command>",
		"Worktree name (if two args) or command (if one arg)",
	)
	.argument("[command]", "Command to run (if name provided)")
	.action(async (nameOrCommand, command) => {
		// If only one argument is provided, it's the command
		// If two arguments are provided, first is name, second is command
		const result = command
			? await worktreeCommand(nameOrCommand, command)
			: await worktreeCommand(nameOrCommand);
		if (!result.success) {
			process.exit(1);
		}
	});

program.parse();
