#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

// Check for verbose flag early
let verbose = false;
for (const arg of process.argv) {
	if (arg === "--verbose" || arg === "-v") verbose = true;
}

/**
 * Logger utility - all output goes to stderr to keep stdout clean for content
 * @type {{info: function(...any): void, warn: function(...any): void, error: function(...any): void}}
 */
const log = {
	info: (...args) => verbose && process.stderr.write(`${args.join(" ")}\n`),
	warn: (...args) => process.stderr.write(`⚠️  ${args.join(" ")}\n`),
	error: (...args) => process.stderr.write(`❌ ${args.join(" ")}\n`),
};

/**
 * Parse command line arguments
 * @returns {{inputDir?: string, outputFile?: string, headerFile?: string, ignore?: string, help: boolean}}
 */
function parseArgs() {
	const args = process.argv.slice(2);
	const result = { help: false, recursive: true };

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === "--help" || arg === "-h") {
			result.help = true;
		} else if (arg === "--input-dir" || arg === "-i") {
			result.inputDir = args[++i];
		} else if (arg.startsWith("--input-dir=")) {
			result.inputDir = arg.split("=")[1];
		} else if (arg === "--output-file" || arg === "-o") {
			result.outputFile = args[++i];
		} else if (arg.startsWith("--output-file=")) {
			result.outputFile = arg.split("=")[1];
		} else if (arg === "--header-file" || arg === "--header") {
			result.headerFile = args[++i];
		} else if (
			arg.startsWith("--header-file=") ||
			arg.startsWith("--header=")
		) {
			result.headerFile = arg.split("=")[1];
		} else if (arg === "--ignore") {
			result.ignore = args[++i];
		} else if (arg.startsWith("--ignore=")) {
			result.ignore = arg.split("=")[1];
		} else if (arg === "--no-recursive") {
			result.recursive = false;
		} else if (arg === "--recursive") {
			result.recursive = true;
		} else if (arg.startsWith("--recursive=")) {
			const val = arg.split("=")[1];
			result.recursive = !(val === "false" || val === "0");
		} else if (arg === "--verbose" || arg === "-v") {
			// Already parsed above, just skip
		}
	}

	return result;
}

/**
 * Display help information
 */
function showHelp() {
	console.log(`
Usage: node merge-markdown.js [options]

Options:
  -i, --input-dir <path>    Path to the input directory (default: ../../docs/rules)
  -o, --output-file <path>  Output file path (default: ../docs/rules-merged.md)
      --header-file <path>  Header file to prepend to the merged output
      --header <path>       Alias for --header-file
      --ignore <filename>   Ignore specific filename during merging
      --no-recursive        Do not recurse into subdirectories (only top-level files)
      --recursive[=true]    Recurse into subdirectories (default: true)
  -v, --verbose            Show detailed progress output
  -h, --help               Show this help message

Examples:
  node merge-markdown.js
  node merge-markdown.js --input-dir ./custom-rules --output-file ./merged.md
  node merge-markdown.js --header-file ./header.md --output-file ./merged.md
  node merge-markdown.js --input-dir ./generated --ignore AGENTS.md --output-file ./merged.md
  `);
}

/**
 * Recursively find all .mdc, .md, .mmd, and .txt files in a directory
 * @param {string} dir - Directory to search in
 * @param {string} [ignoreFile] - Filename to ignore during search
 * @returns {string[]} Array of file paths sorted alphabetically
 */
function findMdcFiles(dir, ignoreFile, recursive = true) {
	const files = [];

	/**
	 * Recursively walk through directory
	 * @param {string} currentDir - Current directory being processed
	 */
	function walkDir(currentDir) {
		let items;
		try {
			items = fs.readdirSync(currentDir);
		} catch (error) {
			log.warn(`Cannot read directory ${currentDir}: ${error.message}`);
			return;
		}

		for (const item of items) {
			const fullPath = path.join(currentDir, item);
			let stat;

			try {
				stat = fs.statSync(fullPath);
			} catch (error) {
				log.warn(`Cannot stat ${fullPath}: ${error.message}`);
				continue;
			}

			if (stat.isDirectory()) {
				if (recursive) {
					walkDir(fullPath);
				}
			} else if (
				item.endsWith(".mdc") ||
				item.endsWith(".md") ||
				item.endsWith(".mmd") ||
				item.endsWith(".txt")
			) {
				// Skip ignored files
				if (ignoreFile && item === ignoreFile) {
					continue;
				}
				files.push(fullPath);
			}
		}
	}

	walkDir(dir);
	return files.sort();
}

/**
 * Increase all heading levels in markdown content by two (e.g., # becomes ###, ## becomes ####)
 * @param {string} content - The markdown content to process
 * @returns {string} Content with increased heading levels
 */
function increaseHeadingLevels(content) {
	return content.replace(/^(#{1,6})\s/gm, "##$1 ");
}

/**
 * Parse frontmatter from markdown content
 * @param {string} content - The markdown content to parse
 * @returns {{frontmatter: Object, content: string}} Parsed frontmatter object and remaining content
 */
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
	for (const line of frontmatterLines) {
		if (line.trim() === "") continue;

		const colonIndex = line.indexOf(":");
		if (colonIndex > 0) {
			const key = line.substring(0, colonIndex).trim();
			let value = line.substring(colonIndex + 1).trim();

			if (value.startsWith('"') && value.endsWith('"')) {
				value = value.slice(1, -1);
			}

			frontmatter[key] = value;
		}
	}

	return {
		frontmatter,
		content: contentLines.join("\n").trim(),
	};
}

/**
 * Merge all .mdc/.md files from input directory into a single markdown file
 * @param {string} [customInputDir] - Custom input directory path
 * @param {string} [customOutputFile] - Custom output file path
 * @param {string} [headerFile] - Header file to prepend to the merged output
 * @param {string} [ignoreFile] - Filename to ignore during merging
 */
function mergeRules(
	customInputDir,
	customOutputFile,
	headerFile,
	ignoreFile,
	recursive,
) {
	const inputDir = customInputDir || path.join(__dirname, "../../docs/rules");
	const outputFile =
		customOutputFile || path.join(__dirname, "../docs/rules-merged.md");

	// Ensure output directory exists
	const outputDir = path.dirname(outputFile);
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	log.info("Finding .mdc/.md/.mmd/.txt files in:", inputDir);
	const mdcFiles = findMdcFiles(inputDir, ignoreFile, recursive !== false);

	if (mdcFiles.length === 0) {
		log.info("No .mdc/.md/.mmd/.txt files found");
		return;
	}

	log.info(`Found ${mdcFiles.length} .mdc/.md/.mmd/.txt files:`);
	for (const file of mdcFiles) {
		log.info(`  - ${path.relative(inputDir, file)}`);
	}

	let mergedContent = "";

	// Add header content if header file is provided
	if (headerFile) {
		if (fs.existsSync(headerFile)) {
			log.info(`Adding header from: ${headerFile}`);
			const headerContent = fs.readFileSync(headerFile, "utf8");
			mergedContent = `${headerContent.trim()}\n\n`;
		} else {
			log.warn(`Header file not found: ${headerFile}`);
		}
	}

	for (const filePath of mdcFiles) {
		log.info(`\nProcessing: ${path.relative(inputDir, filePath)}`);

		const fileContent = fs.readFileSync(filePath, "utf8");
		const fileExt = path.extname(filePath);

		if (mergedContent !== "") {
			mergedContent += "\n\n";
		}

		if (fileExt === ".mmd") {
			// Handle .mmd files - wrap in mermaid code block with filename as header
			const filename = path.basename(filePath, fileExt);
			const title = filename
				.replace(/-/g, " ")
				.replace(/\b\w/g, (l) => l.toUpperCase());
			log.info(`  Processing mermaid file: ${title}`);
			mergedContent += `### ${title}\n\n\`\`\`mermaid\n${fileContent.trim()}\n\`\`\``;
		} else {
			// Handle .md/.mdc files
			const { content } = parseFrontmatter(fileContent);
			const processedContent = increaseHeadingLevels(content);

			mergedContent += processedContent;
		}
	}

	log.info(
		`\nWriting merged content to: ${path.relative(process.cwd(), outputFile)}`,
	);
	fs.writeFileSync(outputFile, mergedContent, "utf8");

	log.info("✅ Rules merged successfully!");
}

if (require.main === module) {
	const args = parseArgs();

	if (args.help) {
		showHelp();
		process.exit(0);
	}

	try {
		mergeRules(
			args.inputDir,
			args.outputFile,
			args.headerFile,
			args.ignore,
			args.recursive,
		);
	} catch (error) {
		log.error("Error merging rules:", error.message);
		process.exit(1);
	}
}

module.exports = {
	mergeRules,
	findMdcFiles,
	parseFrontmatter,
	increaseHeadingLevels,
};
