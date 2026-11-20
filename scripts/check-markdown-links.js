#!/usr/bin/env node

const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const HELP_TEXT = `Usage:
  node scripts/check-markdown-links.js [--ignore path]

Supported link forms:
  - Markdown links and images: [label](path), ![alt](path)
  - Agent context includes/imports: @path/to/file.md
  - Source declarations: src: path/to/file.md

Ignored / excluded forms:
  - Anchor-only links such as #usage
  - mailto: and tel: links
  - HTML angle-bracket links and HTML attributes
  - .git and node_modules directories, plus .stryker-tmp and .e2e-build, which copy the tree
  - Runtime variables, glob patterns, and bare words
  - cli/tests/fixtures/** (synthetic mock trees) and cli/aidd_docs/tasks/**
    (historical task records), always, on top of any --ignore given

How to fix broken links:
  | Need | Use |
  | - | - |
  | Include/import a file in agent context | @path/to/file.md |
  | Reference a file for the reader | [label](path/to/file.md) |

Examples:
  | Case | Example |
  | - | - |
  | Agent include/import | @plugins/aidd-context/skills/11-explore/SKILL.md |
  | Reader reference | See [explore skill](plugins/aidd-context/skills/11-explore/SKILL.md). |
`;

const { linkChecker, DEFAULT_IGNORES } = require("./check/contracts/custom/markdown-links.cjs");

const { normalizePathForDisplay, isIgnored, collectMarkdownFiles, extractLinks, problemForTarget, checkFile } = linkChecker(ROOT);

function parseArgs(argv) {
  const paths = [];
  const ignores = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      return { help: true, paths, ignores };
    }

    if (arg === "--ignore") {
      const ignoredPath = argv[index + 1];
      if (!ignoredPath || ignoredPath.startsWith("--")) {
        throw new Error("--ignore requires a path");
      }
      ignores.push(ignoredPath);
      index += 1;
      continue;
    }

    paths.push(arg);
  }

  return { help: false, paths: paths.length > 0 ? paths : ["."], ignores };
}

function gatherMarkdownFiles(inputs, cwd = ROOT) {
  return collectMarkdownFiles(inputs.length > 0 ? inputs : ["."], []).map((file) => path.resolve(cwd, path.relative(ROOT, file)));
}

function filterIgnoredFiles(files, ignore = [], root = ROOT) {
  if (ignore.length === 0) {
    return files;
  }

  const ignoredPaths = ignore.map((ignoredPath) => path.resolve(root, ignoredPath));
  return files.filter((file) => !isIgnored(file, ignoredPaths));
}

function checkMarkdownLinks(pathsToCheck, ignoredPaths = []) {
  const files = collectMarkdownFiles(pathsToCheck, ignoredPaths);
  const problems = files.flatMap((file) => checkFile(file));
  return { files, problems };
}

function findBrokenLinks(files) {
  return files.flatMap((file) => checkFile(file));
}

function issueLink(problem) {
  return problem.raw ?? problem.link;
}

function issueReason(problem) {
  if (problem.reason) {
    return problem.reason;
  }

  switch (problem.type) {
    case "cross-repo":
      return "cross-repo-relative-link";
    case "broken-remote":
      return "remote-url-not-found";
    case "broken-template":
      return "template-path-not-found";
    default:
      return problem.type;
  }
}

function formatIssue(problem) {
  const link = issueLink(problem);

  switch (issueReason(problem)) {
    case "cross-repo-relative-link":
      return `${link} (cross-repo relative link; suggestion: ${problem.suggestion})`;
    case "remote-url-not-found":
      return `${link} (remote URL not found locally)`;
    case "template-path-not-found":
      return `${link} (template path not found in framework source)`;
    case "local-path-not-found":
      return `${link} (local path not found)`;
    case "anchor-not-found":
      return `${link} (no heading in the target file answers that fragment)`;
    default:
      return `${link} (file not found)`;
  }
}

function escapeMarkdownTableCell(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function reportProblems(problems, checkedFileCount, logger = console.error, successLogger = console.log) {
  if (problems.length === 0) {
    successLogger(`✅ Links: 0 broken in ${checkedFileCount} files`);
    return 0;
  }

  logger("| source | issue |");
  logger("| - | - |");

  for (const problem of problems) {
    const source = `${normalizePathForDisplay(problem.file)}:${problem.line}`;
    logger(`| ${escapeMarkdownTableCell(source)} | ${escapeMarkdownTableCell(formatIssue(problem))} |`);
  }

  logger("");
  logger(`❌ Links: ${problems.length} broken in ${checkedFileCount} files`);
  return 1;
}

function runCli(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    console.error("Run with --help for usage.");
    return 1;
  }

  if (parsed.help) {
    console.log(HELP_TEXT);
    return 0;
  }

  try {
    const { files, problems } = checkMarkdownLinks(parsed.paths, [...DEFAULT_IGNORES, ...parsed.ignores]);
    reportProblems(problems, files.length);
    return problems.length === 0 ? 0 : 1;
  } catch (error) {
    console.error(`❌ ${error.message}`);
    return 1;
  }
}

function run(inputs, { ignore = [] } = {}) {
  try {
    const { files, problems } = checkMarkdownLinks(inputs && inputs.length > 0 ? inputs : ["."], ignore);
    reportProblems(problems, files.length);
    return problems.length === 0 ? 0 : 1;
  } catch (error) {
    console.error(`❌ ${error.message}`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runCli();
}

module.exports = {
  HELP_TEXT,
  checkFile,
  checkMarkdownLinks,
  collectMarkdownFiles,
  extractLinks,
  filterIgnoredFiles,
  formatIssue,
  gatherMarkdownFiles,
  findBrokenLinks,
  parseArgs,
  problemForTarget,
  reportProblems,
  run,
  runCli,
};
