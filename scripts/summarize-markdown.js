#!/usr/bin/env node

/**
 * Summarize Markdown Structure
 *
 * Scans a directory and generates markdown documentation with frontmatter metadata.
 * Supports injection mode using markers to update content within existing files.
 *
 * Usage:
 *   node summarize-markdown.js [inputPath] [outputPath] [options]
 *
 * Arguments:
 *   inputPath (optional) - Path to directory to scan. Defaults to '../prompts' relative to script location.
 *   outputPath (optional) - Path to output file. Defaults to '../docs/prompts-documentation.md'.
 *
 * Options:
 *   --depth=N   - Maximum depth to scan subdirectories (default: 3)
 *   --verbose   - Enable verbose output
 *   -v          - Alias for --verbose
 *
 *
 * Examples:
 *   node summarize-markdown.js                              # Uses defaults
 *   node summarize-markdown.js ./my-prompts                 # Custom input
 *   node summarize-markdown.js ./prompts docs/INDEX.md      # Custom input & output
 *   node summarize-markdown.js framework out.md --depth=4   # Scan 4 levels deep
 *
 * Supported file extensions: .md, .mdc, .txt
 *
 * Output:
 *   Generates or updates markdown file with organized tables of all files.
 */


// Parse CLI flags early
let verbose = false;
let maxDepth = 3; // Default depth
let customTitle = null;
let customTagline = null;
for (const arg of process.argv) {
	if (arg === "--verbose" || arg === "-v") verbose = true;
	if (arg.startsWith("--depth=")) {
		const depthValue = Number.parseInt(arg.split("=")[1], 10);
		if (!Number.isNaN(depthValue) && depthValue > 0) {
			maxDepth = depthValue;
		}
	}
	if (arg.startsWith("--title=")) {
		customTitle = arg.slice("--title=".length);
	}
	if (arg.startsWith("--tagline=")) {
		customTagline = arg.slice("--tagline=".length);
	}
}

let allowedFields = null; // null = dynamic discovery (backwards compatibility)
const ignoreNames = new Set();
for (const arg of process.argv) {
	if (arg.startsWith("--fields=")) {
		allowedFields = arg.split("=")[1].split(",").map(f => f.trim());
	}
	if (arg.startsWith("--ignore=")) {
		for (const dir of arg.split("=")[1].split(",")) {
			ignoreNames.add(dir.trim());
		}
	}
}

const fs = require("node:fs");
const path = require("node:path");

function parseFrontmatter(content) {
	const lines = content.split("\n");

	if (lines[0] !== "---") {
		return { frontmatter: {}, content: content };
	}

	let endIndex = -1;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i] === "---") {
			endIndex = i;
			break;
		}
	}

	if (endIndex === -1) {
		return { frontmatter: {}, content: content };
	}

	const frontmatterLines = lines.slice(1, endIndex);
	const contentLines = lines.slice(endIndex + 1);

	const frontmatter = {};
	let currentKey = null;
	let currentValue = "";
	let isMultiline = false;
	let multilineType = null; // '>' for folded, '|' for literal

	for (const line of frontmatterLines) {
		// Check if continuation line (starts with whitespace and has content)
		if (isMultiline && line.match(/^\s+\S/)) {
			const separator = multilineType === "|" ? "\n" : " ";
			currentValue += (currentValue ? separator : "") + line.trim();
			continue;
		}

		// Save previous key if exists
		if (currentKey && currentValue) {
			frontmatter[currentKey] = currentValue.trim();
		}

		// Skip empty lines
		if (line.trim() === "") {
			currentKey = null;
			currentValue = "";
			isMultiline = false;
			continue;
		}

		// Parse new key: value
		const colonIndex = line.indexOf(":");
		if (colonIndex > 0) {
			currentKey = line.substring(0, colonIndex).trim();
			let value = line.substring(colonIndex + 1).trim();

			// Check for multiline indicators
			if (value === ">-" || value === ">" || value === "|" || value === "|-") {
				isMultiline = true;
				multilineType = value.startsWith("|") ? "|" : ">";
				currentValue = "";
			} else {
				isMultiline = false;
				if (value.startsWith('"') && value.endsWith('"')) {
					value = value.slice(1, -1);
				}
				currentValue = value;
			}
		}
	}

	// Don't forget last key
	if (currentKey && currentValue) {
		frontmatter[currentKey] = currentValue.trim();
	}

	return {
		frontmatter,
		content: contentLines.join("\n").trim(),
	};
}

/**
 * Check if a file should be included in the catalog scan.
 * Markdown files (.md, .mdc, .txt) will have frontmatter parsed.
 * Other supported files (.json, .js, .sh) are listed without frontmatter.
 * @param {string} filename
 * @returns {boolean}
 */
function isScannableFile(filename) {
	return (
		filename.endsWith(".md") ||
		filename.endsWith(".mdc") ||
		filename.endsWith(".txt") ||
		filename.endsWith(".json") ||
		filename.endsWith(".js") ||
		filename.endsWith(".sh")
	);
}

function isDirectSkillReadmeSymlink(itemPath, relativePath, filename) {
	if (filename !== "README.md") {
		return false;
	}
	if (path.basename(path.dirname(path.dirname(itemPath))) !== "skills") {
		return false;
	}
	if (relativePath.split(path.sep).length !== 1) {
		return false;
	}
	return fs.lstatSync(itemPath).isSymbolicLink() && fs.readlinkSync(itemPath) === "SKILL.md";
}

/**
 * Recursively scan a directory for markdown files up to a maximum depth
 * @param {string} dir - Directory to scan
 * @param {number} currentDepth - Current recursion depth
 * @param {number} maxScanDepth - Maximum depth to scan
 * @param {string} relativePath - Relative path from the top-level folder
 * @returns {Array} Array of file objects
 */
function scanDirectoryRecursive(dir, currentDepth, maxScanDepth, relativePath = "") {
	const files = [];

	if (currentDepth > maxScanDepth) {
		return files;
	}

	const items = fs.readdirSync(dir).sort();

	for (const item of items) {
		const itemPath = path.join(dir, item);
		if (isDirectSkillReadmeSymlink(itemPath, relativePath, item)) {
			continue;
		}
		const stat = fs.statSync(itemPath);

		if (stat.isFile() && isScannableFile(item) && !ignoreNames.has(item)) {
			const name = relativePath ? path.join(relativePath, item) : item;
			files.push({
				name,
				path: itemPath,
				isMarkdown: item.endsWith(".md") || item.endsWith(".mdc"),
			});
		} else if (stat.isDirectory() && item !== 'dist' && item !== 'node_modules' && item !== '.git') {
			const nestedRelativePath = relativePath ? path.join(relativePath, item) : item;
			const nestedFiles = scanDirectoryRecursive(
				itemPath,
				currentDepth + 1,
				maxScanDepth,
				nestedRelativePath
			);
			files.push(...nestedFiles);
		}
	}

	return files;
}

function scanPromptsDirectory(dir, scanDepth = maxDepth) {
	const folders = {};

	if (!fs.existsSync(dir)) {
		throw new Error(`Prompts directory not found: ${dir}`);
	}

	const items = fs.readdirSync(dir).sort();

	for (const item of items) {
		const itemPath = path.join(dir, item);
		const stat = fs.statSync(itemPath);

		if (stat.isDirectory() && item !== 'dist' && item !== 'node_modules' && item !== '.git' && !ignoreNames.has(item)) {
			// Recursively scan subdirectory with configurable depth
			// Start at depth 1 since we're inside the first-level folder
			const files = scanDirectoryRecursive(itemPath, 1, scanDepth - 1, "");
			folders[item] = files.sort((a, b) => a.name.localeCompare(b.name));
		}
	}

	return folders;
}

function truncateText(text, maxLength = 50) {
	if (!text || text.length <= maxLength) {
		return text || "N/A";
	}
	return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * Group files by their first path component (subfolder)
 * @param {Array} files - Array of file objects
 * @returns {Object} Object with subfolder names as keys and file arrays as values
 */
function groupFilesBySubfolder(files) {
	const groups = {};
	const rootFiles = [];

	for (const file of files) {
		const parts = file.name.split("/");
		if (parts.length > 1) {
			const subfolder = parts[0];
			if (!groups[subfolder]) {
				groups[subfolder] = [];
			}
			groups[subfolder].push({
				...file,
				// Store the relative name without the first subfolder
				relativeName: parts.slice(1).join("/"),
			});
		} else {
			rootFiles.push(file);
		}
	}

	// Add root files under a special key if any exist
	if (rootFiles.length > 0) {
		groups["_root"] = rootFiles;
	}

	return groups;
}

/**
 * Generate a table of contents from markdown headings (h3/h4).
 * Produces GitHub-compatible anchor links (same as VS Code Markdown All in One).
 * @param {string} markdown - Markdown content to extract headings from
 * @returns {string} TOC as markdown list
 */
function generateToc(markdown) {
	const lines = markdown.split("\n");
	const tocLines = [];

	for (const line of lines) {
		const match = line.match(/^(#{3,4})\s+(.+)/);
		if (match) {
			const level = match[1].length;
			const text = match[2].trim();
			const anchor = text
				.toLowerCase()
				.replace(/`/g, "")
				.replace(/[^\w\s-]/g, "")
				.trim()
				.replace(/\s+/g, "-");
			const indent = "  ".repeat(level - 3);
			tocLines.push(`${indent}- [${text}](#${anchor})`);
		}
	}

	return tocLines.join("\n");
}

/**
 * Generate a markdown table for a group of files
 * Dynamically discovers columns from frontmatter keys.
 * @param {Array} files - Array of file objects
 * @param {string} outputFile - Path to output file for relative links
 * @returns {string} Markdown table content
 */
function generateTable(files, outputFile) {
	// First pass: parse all files and collect frontmatter keys
	const parsedFiles = [];
	const allKeys = new Set();

	for (const file of files) {
		try {
			const content = fs.readFileSync(file.path, "utf8");
			let frontmatter = {};
			if (file.isMarkdown) {
				frontmatter = parseFrontmatter(content).frontmatter;
			}
			parsedFiles.push({ file, frontmatter });
			for (const key of Object.keys(frontmatter)) {
				if (key !== "name") allKeys.add(key);
			}
		} catch (error) {
			console.warn(
				`  Warning: Could not read file ${file.path}: ${error.message}`,
			);
			parsedFiles.push({ file, frontmatter: {} });
		}
	}

	// Build columns from discovered keys (preserve insertion order)
	const extraColumns = allowedFields
		? allowedFields.filter(f => allKeys.has(f))
		: [...allKeys];

	// Pre-compute rows to detect if Group column has any meaningful value
	const rows = [];
	let hasGroup = false;
	for (const { file, frontmatter } of parsedFiles) {
		const relativePath = path.relative(path.dirname(outputFile), file.path);
		const displayName = file.relativeName || file.name;
		const parts = displayName.split("/");
		const group = parts.length > 1 ? parts.slice(0, -1).join("/") : "-";
		if (group !== "-") hasGroup = true;
		const template = parts[parts.length - 1];
		const fileLink = `[${template}](${relativePath})`;
		const values = extraColumns.map((key) => {
			const val = frontmatter[key];
			return val && val !== "N/A" ? `\`${val}\`` : "-";
		});
		rows.push({ group, fileLink, values });
	}

	// Header
	const formatHeader = (key) =>
		key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	const groupHeader = hasGroup ? "| Group " : "";
	const groupSep = hasGroup ? "|-------" : "";
	let markdown = `${groupHeader}| File |${extraColumns.length > 0 ? ` ${extraColumns.map(formatHeader).join(" | ")} |` : ""}\n`;
	markdown += `${groupSep}|------|${extraColumns.map(() => "---").join("|")}${extraColumns.length > 0 ? "|" : ""}\n`;

	// Rows
	for (const { group, fileLink, values } of rows) {
		const groupCell = hasGroup ? `| \`${group}\` ` : "";
		markdown += `${groupCell}| ${fileLink} |${values.length > 0 ? ` ${values.join(" | ")} |` : ""}\n`;
	}

	return markdown;
}

/**
 * Generate markdown documentation for a folder with subsections
 * @param {array} files
 * @param {string} folderName
 * @param {string} outputFile
 * @returns {string}
 */
function generateMarkdownTable(files, folderName, outputFile) {
	if (!files || files.length === 0) {
		return `### \`${folderName.toLowerCase()}\`\n\nNo files found.\n`;
	}

	let markdown = `### \`${folderName.toLowerCase()}\`\n\n`;

	// Group files by their first subfolder
	const groups = groupFilesBySubfolder(files);
	const sortedGroupNames = Object.keys(groups).sort((a, b) => {
		// Put _root first if it exists
		if (a === "_root") return -1;
		if (b === "_root") return 1;
		return a.localeCompare(b);
	});

	// If there's only one group and it's _root, or no subfolders, use flat table
	if (sortedGroupNames.length === 1 && sortedGroupNames[0] === "_root") {
		markdown += generateTable(groups["_root"], outputFile);
		return `${markdown}\n`;
	}

	// Generate subsections for each group
	for (const groupName of sortedGroupNames) {
		const groupFiles = groups[groupName];

		if (groupName === "_root") {
			// Root files without subsection header
			markdown += generateTable(groupFiles, outputFile);
			markdown += "\n";
		} else {
			// Subsection with header
			markdown += `#### \`${folderName.toLowerCase()}/${groupName}\`\n\n`;
			markdown += generateTable(groupFiles, outputFile);
			markdown += "\n";
		}
	}

	return markdown;
}

function generatePromptsDocumentation(customPath = null, customOutput = null) {
	const promptsDir = customPath
		? path.resolve(customPath)
		: path.join(__dirname, "../../prompts");
	const outputFile = customOutput
		? path.resolve(customOutput)
		: path.join(__dirname, "../docs/prompts-documentation.md");

	if (verbose) console.log("Starting prompts documentation generation...");
	if (verbose) console.log(`Scanning: ${promptsDir}`);

	const folders = scanPromptsDirectory(promptsDir);

	if (verbose) console.log(`Found ${Object.keys(folders).length} folders with prompts`);

	// Sort folders by name to ensure consistent output
	const sortedFolderNames = Object.keys(folders).sort();

	// Generate sections content (tables organized by folder)
	let sectionsContent = "";
	for (const folderName of sortedFolderNames) {
		if (verbose) console.log(
			`  Processing folder: ${folderName} (${folders[folderName].length} files)`,
		);
		sectionsContent += generateMarkdownTable(
			folders[folderName],
			folderName,
			outputFile,
		);
	}

	// Generate TOC from section headings
	const toc = generateToc(sectionsContent);

	// Build full file content
	const title = customTitle ?? "AIDD Framework Catalog";
	const tagline =
		customTagline ??
		"Auto-generated framework content: agents, commands, rules, skills, and templates.";
	let markdownContent = `# ${title}\n\n`;
	markdownContent += `${tagline}\n\n`;
	markdownContent += "> This file is automatically updated by the `scripts/summarize-markdown.js` script.\n\n";
	markdownContent += "## Table of Contents\n\n";
	markdownContent += toc + "\n\n---\n\n";
	markdownContent += sectionsContent;

	// Write output
	const outputDir = path.dirname(outputFile);
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	fs.writeFileSync(outputFile, markdownContent, "utf8");

	if (verbose) {
		console.log(
			`✅ Documentation generated: ${path.relative(process.cwd(), outputFile)}`,
		);
		console.log(`📄 Total folders processed: ${sortedFolderNames.length}`);
		console.log(
			`📁 Total files processed: ${Object.values(folders).reduce(
				(sum, files) => sum + files.length,
				0,
			)}`,
		);
	}
}

if (require.main === module) {
	try {
		const customPath = process.argv[2];
		const customOutput = process.argv[3];
		generatePromptsDocumentation(customPath, customOutput);
	} catch (error) {
		console.error("❌ Error generating prompts documentation:", error.message);
		process.exit(1);
	}
}

module.exports = {
	generateMarkdownTable,
	generatePromptsDocumentation,
	generateTable,
	generateToc,
	groupFilesBySubfolder,
	parseFrontmatter,
	scanPromptsDirectory,
	truncateText,
};
