import { describe, expect, it } from "vitest";
import {
	createAutoComponentSelection,
	createComponentSelection,
	createFullComponentSelection,
} from "../../../domain/install/component-selections.js";

describe("componentSelections", () => {
	describe("createAutoComponentSelection", () => {
		it("should create auto component selection", () => {
			const result = createAutoComponentSelection();

			expect(result).toEqual({
				ide: {
					claudeCode: true,
					copilot: true,
					cursor: false,
					vscode: true,
					windsurf: false,
				},
				project: {
					documentation: true,
				},
				framework: {
					mandatory: true,
				},
			});
		});
	});

	describe("createFullComponentSelection", () => {
		it("should create full component selection with all components", () => {
			const result = createFullComponentSelection();

			expect(result).toEqual({
				ide: {
					claudeCode: true,
					copilot: true,
					cursor: true,
					vscode: true,
					windsurf: true,
				},
				project: {
					documentation: true,
				},
				framework: {
					mandatory: true,
				},
			});
		});
	});

	describe("createComponentSelection", () => {
		it("should create component selection with provided values", () => {
			const result = createComponentSelection(
				{
					claudeCode: true,
					copilot: false,
					cursor: false,
					vscode: true,
					windsurf: false,
				},
				{ documentation: true },
				{ mandatory: true },
			);

			expect(result).toEqual({
				ide: {
					claudeCode: true,
					copilot: false,
					cursor: false,
					vscode: true,
					windsurf: false,
				},
				project: {
					documentation: true,
				},
				framework: {
					mandatory: true,
				},
			});
		});

		it("should use default values when optional parameters are not provided", () => {
			const result = createComponentSelection({
				claudeCode: false,
				copilot: false,
				cursor: false,
				vscode: false,
				windsurf: false,
			});

			expect(result.project).toEqual({
				documentation: true,
			});
			expect(result.framework).toEqual({
				mandatory: true,
			});
		});
	});
});
