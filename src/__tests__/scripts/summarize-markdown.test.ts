import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const START_MARKER = "<!-- AIDD-SUMMARY-START -->";
const END_MARKER = "<!-- AIDD-SUMMARY-END -->";

describe("summarize-markdown injection", () => {
	let tempDir: string;
	let inputDir: string;
	let outputFile: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "summarize-md-test-"));
		inputDir = path.join(tempDir, "input");
		outputFile = path.join(tempDir, "output.md");

		// Create input directory with nested structure for subsection testing
		// Structure: input/ide/agents/agent1.md, input/ide/prompts/prompt1.md
		fs.mkdirSync(path.join(inputDir, "ide", "agents"), { recursive: true });
		fs.mkdirSync(path.join(inputDir, "ide", "prompts"), { recursive: true });
		fs.writeFileSync(
			path.join(inputDir, "ide", "agents", "test-agent.md"),
			`---
name: test-agent
description: A test agent
---
# Agent content`,
		);
		fs.writeFileSync(
			path.join(inputDir, "ide", "prompts", "test-prompt.md"),
			`---
name: test-prompt
description: A test prompt
---
# Prompt content`,
		);
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	async function runScript(): Promise<void> {
		const module = (await import(
			// @ts-expect-error - external mjs script without types
			"../../../../scripts/summarize-markdown.mjs"
		)) as {
			generatePromptsDocumentation: (
				inputPath: string,
				outputPath: string,
			) => void;
		};
		module.generatePromptsDocumentation(inputDir, outputFile);
	}

	it("creates new file when output does not exist", async () => {
		await runScript();

		expect(fs.existsSync(outputFile)).toBe(true);
		const content = fs.readFileSync(outputFile, "utf8");
		expect(content).toContain("# Prompts Documentation");
	});

	it("generates subsections for nested folders", async () => {
		await runScript();

		const content = fs.readFileSync(outputFile, "utf8");
		// Check for main section (lowercase with backticks)
		expect(content).toContain("### `ide`");
		// Check for subsections (full path with backticks)
		expect(content).toContain("#### `ide/agents`");
		expect(content).toContain("#### `ide/prompts`");
		// Check for file entries
		expect(content).toContain("test-agent");
		expect(content).toContain("test-prompt");
	});

	it("throws error when file exists without markers", async () => {
		fs.writeFileSync(outputFile, "# Old Content\n\nThis file has no markers.");

		await expect(runScript()).rejects.toThrow("missing required markers");
	});

	it("throws error when file has only start marker", async () => {
		fs.writeFileSync(
			outputFile,
			`# Doc\n\n${START_MARKER}\n\nNo end marker here.`,
		);

		await expect(runScript()).rejects.toThrow("missing required markers");
	});

	it("throws error when file has only end marker", async () => {
		fs.writeFileSync(outputFile, `# Doc\n\n${END_MARKER}\n\nNo start marker.`);

		await expect(runScript()).rejects.toThrow("missing required markers");
	});

	it("replaces only content between markers when markers exist", async () => {
		const originalContent = `# My Document

Some content before markers.

${START_MARKER}
Old generated content here
${END_MARKER}

Some content after markers.
`;
		fs.writeFileSync(outputFile, originalContent);

		await runScript();

		const content = fs.readFileSync(outputFile, "utf8");
		// Content outside markers preserved
		expect(content).toContain("# My Document");
		expect(content).toContain("Some content before markers.");
		expect(content).toContain("Some content after markers.");
		// Old content replaced
		expect(content).not.toContain("Old generated content here");
		// New content injected
		expect(content).toContain("# Prompts Documentation");
		// Markers still present
		expect(content).toContain(START_MARKER);
		expect(content).toContain(END_MARKER);
	});

	it("preserves exact content before and after markers", async () => {
		const before = "# Header\n\nParagraph with special chars: éàü & <tag>\n\n";
		const after = "\n\n## Footer\n\nFinal paragraph.";
		const originalContent = `${before}${START_MARKER}\nOld\n${END_MARKER}${after}`;
		fs.writeFileSync(outputFile, originalContent);

		await runScript();

		const content = fs.readFileSync(outputFile, "utf8");
		expect(content.startsWith(before + START_MARKER)).toBe(true);
		expect(content.endsWith(END_MARKER + after)).toBe(true);
	});

	it("is idempotent - running twice produces same result", async () => {
		const originalContent = `# Doc\n\n${START_MARKER}\n${END_MARKER}\n\nEnd.`;
		fs.writeFileSync(outputFile, originalContent);

		await runScript();
		const firstRun = fs.readFileSync(outputFile, "utf8");

		await runScript();
		const secondRun = fs.readFileSync(outputFile, "utf8");

		expect(firstRun).toBe(secondRun);
	});
});
